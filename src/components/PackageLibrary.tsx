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

export function PackageLibrary({ pyodideWorker }: { pyodideWorker?: Worker }) {
  const [installedPackages, setInstalledPackages] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadInstalledPackages = async () => {
      if (pyodideWorker) {
        const result = await agentToolRegistry.execute("list_packages", {
          pyodideWorker,
        });
        if (result.success && result.data?.packages) {
          setInstalledPackages(result.data.packages);
        }
      }
    };
    loadInstalledPackages();
  }, [pyodideWorker]);

  const installPackage = async (packageName: string) => {
    if (pyodideWorker) {
      const result = await agentToolRegistry.execute("install_package", {
        pyodideWorker,
        package: packageName,
      });
      if (result.success) {
        setInstalledPackages([...installedPackages, packageName]);
      } else {
        console.error(result.error);
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
            {installedPackages.map((packageName) => (
              <div key={packageName}>
                <Button
                  variant="outline"
                  onClick={() => installPackage(packageName)}
                >
                  {packageName}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </form>
    </Dialog>
  );
}
