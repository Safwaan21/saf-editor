import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { agentToolRegistry } from "@/tools";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function PackageLibrary({ pyodideWorker }: { pyodideWorker?: Worker }) {
  const [installedPackages, setInstalledPackages] = useState<Set<string>>(
    new Set()
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadInstalledPackages = async () => {
      if (pyodideWorker) {
        const result = await agentToolRegistry.execute("list_packages", {
          pyodideWorker,
        });
        if (result.success && result.data?.packages) {
          setInstalledPackages(new Set(result.data.packages));
        }
      }
    };
    loadInstalledPackages();
  }, [pyodideWorker]);

  const installPackage = async (packageName: string) => {
    if (pyodideWorker) {
      const result = await agentToolRegistry.execute("install_package", {
        pyodideWorker,
        packageName,
      });
      if (result.success) {
        setInstalledPackages(new Set(installedPackages).add(packageName));
      } else {
        toast.error(
          "Failed to load installed package. Please check to make sure it exists. "
        );
      }
    }
  };

  return (
    <Dialog>
      <form>
        <DialogTrigger asChild>
          <Button variant="outline">Package Library</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Package Library</DialogTitle>
            <DialogDescription>
              Install packages to your Python environment.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            placeholder="Search packages"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={() => installPackage(search)}>Install</Button>
          <div className="grid gap-4">
            {Array.from(installedPackages).map((packageName) => (
              <div key={packageName}>
                <Badge>{packageName}</Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </form>
    </Dialog>
  );
}
