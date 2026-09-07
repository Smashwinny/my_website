#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${COMPANION_CODEX_NATIVE:?Set COMPANION_CODEX_NATIVE to the native Codex binary}"
exec bwrap --die-with-parent --new-session --unshare-pid --unshare-ipc --unshare-uts \
  --clearenv --setenv PATH /usr/bin:/bin --setenv HOME /workspace --setenv CODEX_HOME /codex \
  --ro-bind /usr /usr --ro-bind /lib /lib --ro-bind /lib64 /lib64 \
  --ro-bind /etc/ssl /etc/ssl --ro-bind /etc/resolv.conf /etc/resolv.conf \
  --ro-bind /etc/hosts /etc/hosts --proc /proc --dev /dev --dir /workspace \
  --bind "$project_root/.companion-codex" /codex \
  --bind "$project_root/tmp/companion" "$project_root/tmp/companion" \
  --ro-bind "$COMPANION_CODEX_NATIVE" /companion-codex \
  --chdir /workspace -- /companion-codex "$@"
