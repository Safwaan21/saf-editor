import type { FileNode } from "../App";

interface SerializedNode {
  n: string; // name
  t: "f" | "d"; // type (f=file, d=directory)
  c?: string; // content
  ch?: SerializedNode[]; // children
  e?: boolean; // expanded
}

interface SerializedWorkspace {
  v: number; // version
  f: SerializedNode[]; // files
  ts: number; // timestamp
}

// Compression using built-in browser APIs
class WorkspaceSerializer {
  private static textEncoder = new TextEncoder();
  private static textDecoder = new TextDecoder();

  /**
   * Compress data using the Compression Streams API (modern browsers)
   * Falls back to basic base64 encoding if not available
   */
  private static async compressData(data: string): Promise<string> {
    try {
      // Check if CompressionStream is available (modern browsers)
      if ("CompressionStream" in window) {
        const stream = new CompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const chunks: Uint8Array[] = [];

        // Start reading compressed chunks
        const readPromise = (async () => {
          let result;
          while (!(result = await reader.read()).done) {
            chunks.push(result.value);
          }
        })();

        // Write data to compress
        await writer.write(this.textEncoder.encode(data));
        await writer.close();
        await readPromise;

        // Combine chunks and convert to base64
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        return btoa(String.fromCharCode(...combined));
      } else {
        // Fallback to basic base64 encoding
        console.warn("CompressionStream not available, using base64 only");
        return btoa(data);
      }
    } catch (error) {
      console.error("Compression failed:", error);
      return btoa(data); // Fallback to base64
    }
  }

  /**
   * Decompress data compressed with compressData
   */
  private static async decompressData(compressed: string): Promise<string> {
    try {
      if ("DecompressionStream" in window) {
        const bytes = Uint8Array.from(atob(compressed), (c) => c.charCodeAt(0));

        const stream = new DecompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const chunks: Uint8Array[] = [];

        // Start reading decompressed chunks
        const readPromise = (async () => {
          let result;
          while (!(result = await reader.read()).done) {
            chunks.push(result.value);
          }
        })();

        // Write compressed data
        await writer.write(bytes);
        await writer.close();
        await readPromise;

        // Combine chunks and decode
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        return this.textDecoder.decode(combined);
      } else {
        // Fallback from base64
        return atob(compressed);
      }
    } catch (error) {
      console.error("Decompression failed:", error);
      throw new Error("Failed to decompress workspace data");
    }
  }

  /**
   * Serialize workspace to a compact format for sharing
   */
  private static serializeWorkspace(fileTree: FileNode[]): SerializedWorkspace {
    const serialize = (nodes: FileNode[]): SerializedNode[] => {
      return nodes.map((node) => {
        const serialized: SerializedNode = {
          n: node.name, // name
          t: node.type === "file" ? "f" : "d", // type (f=file, d=directory)
        };

        if (node.content !== undefined) {
          serialized.c = node.content; // content
        }

        if (node.children && node.children.length > 0) {
          serialized.ch = serialize(node.children); // children
        }

        if (node.isExpanded) {
          serialized.e = true; // expanded
        }

        return serialized;
      });
    };

    return {
      v: 1, // version for future compatibility
      f: serialize(fileTree), // files
      ts: Date.now(), // timestamp
    };
  }

  /**
   * Deserialize workspace from compact format
   */
  private static deserializeWorkspace(data: any): FileNode[] {
    if (!data || data.v !== 1) {
      throw new Error("Unsupported workspace format");
    }

    let idCounter = 1;
    const generateId = () => `shared-${idCounter++}`;

    const deserialize = (nodes: any[]): FileNode[] => {
      return nodes.map((node) => {
        const fileNode: FileNode = {
          id: generateId(),
          name: node.n,
          type: node.t === "f" ? "file" : "folder",
          isExpanded: node.e || false,
        };

        if (node.c !== undefined) {
          fileNode.content = node.c;
        }

        if (node.ch && Array.isArray(node.ch)) {
          fileNode.children = deserialize(node.ch);
        }

        return fileNode;
      });
    };

    return deserialize(data.f);
  }

  /**
   * Create a shareable URL from workspace
   */
  static async createShareableURL(
    fileTree: FileNode[],
    baseURL: string = window.location.origin + window.location.pathname
  ): Promise<string> {
    try {
      const serialized = this.serializeWorkspace(fileTree);
      const jsonString = JSON.stringify(serialized);
      const compressed = await this.compressData(jsonString);

      // URL-safe base64 encoding
      const urlSafe = compressed
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const url = `${baseURL}#workspace=${urlSafe}`;

      // Check URL length (browsers typically support 2000+ chars, but let's be conservative)
      if (url.length > 8192) {
        throw new Error(
          `URL too long (${url.length} chars). Consider using fewer files or external storage.`
        );
      }

      return url;
    } catch (error) {
      console.error("Failed to create shareable URL:", error);
      throw error;
    }
  }

  /**
   * Load workspace from URL hash
   */
  static async loadWorkspaceFromURL(): Promise<FileNode[] | null> {
    try {
      const hash = window.location.hash;
      const match = hash.match(/workspace=([^&]+)/);

      if (!match) {
        return null;
      }

      const urlSafeCompressed = match[1];

      // Convert back from URL-safe base64
      const compressed =
        urlSafeCompressed.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (urlSafeCompressed.length % 4)) % 4);

      const jsonString = await this.decompressData(compressed);
      const data = JSON.parse(jsonString);

      return this.deserializeWorkspace(data);
    } catch (error) {
      console.error("Failed to load workspace from URL:", error);
      return null;
    }
  }

  /**
   * Get compression statistics for debugging
   */
  static async getCompressionStats(fileTree: FileNode[]): Promise<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    urlLength: number;
  }> {
    const serialized = this.serializeWorkspace(fileTree);
    const jsonString = JSON.stringify(serialized);
    const compressed = await this.compressData(jsonString);

    const urlSafe = compressed
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const url = `${window.location.origin}${window.location.pathname}#workspace=${urlSafe}`;

    return {
      originalSize: jsonString.length,
      compressedSize: compressed.length,
      compressionRatio: jsonString.length / compressed.length,
      urlLength: url.length,
    };
  }
}

export { WorkspaceSerializer };
