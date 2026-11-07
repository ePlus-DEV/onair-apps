import os
import subprocess
import tempfile
from pathlib import Path

root = Path.cwd()
web = root / "upstream-web"
base = (root / "sync/web-main-base.txt").read_text().strip()
head = subprocess.check_output(["git", "-C", str(web), "rev-parse", "origin/main"], text=True).strip()
subprocess.run(["git", "-C", str(web), "merge-base", "--is-ancestor", base, head], check=True)
paths = subprocess.check_output(["git", "-C", str(web), "diff", "--name-only", "-z", "--no-renames", base, head, "--", "public/radio", "components", "composables", "stores", "utils", "pages", "lang", "assets"], text=True).split("\0")
conflicts = []
changed = []
def blob(rev, path):
    p = subprocess.run(["git", "-C", str(web), "show", rev + ":" + path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return p.stdout if p.returncode == 0 else None

for name in filter(None, paths):
    target = root / "frontend" / name
    old, new = blob(base, name), blob(head, name)
    current = target.read_bytes() if target.is_file() else None
    if current == new:
        continue
    if current == old:
        result = new
    elif old is not None and new is not None and current is not None and b"\0" not in current + old + new:
        with tempfile.TemporaryDirectory() as temp:
            files = [Path(temp) / str(i) for i in range(3)]
            for file, data in zip(files, (current, old, new)):
                file.write_bytes(data)
            merged = subprocess.run(["git", "merge-file", "-p", *map(str, files)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            result = merged.stdout if merged.returncode == 0 else None
        if result is None:
            conflicts.append(name)
            continue
    else:
        conflicts.append(name)
        continue
    if result is None:
        if target.is_file():
            target.unlink()
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(result)
    changed.append(name)

report = root / "sync/web-review.md"
report.write_text("# Web production sync\n\nSource: " + head + "\n\nPrevious checkpoint: " + base + "\n\n" +
    ("The checkpoint was not advanced. Resolve each conflict manually and rerun synchronization.\n\n" if conflicts else "Checkpoint advances when this PR is merged.\n\n") +
    "## Applied paths\n\n" + "".join("- " + p + "\n" for p in changed) +
    "\n## Paths requiring manual review\n\n" + "".join("- " + p + "\n" for p in conflicts), encoding="utf-8")
if not conflicts:
    (root / "sync/web-main-base.txt").write_text(head + "\n")
print("source", head, "applied", len(changed), "conflicts", len(conflicts))
