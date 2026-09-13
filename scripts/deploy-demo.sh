#!/usr/bin/env bash

set -euo pipefail

cat >&2 <<'EOF'
deploy-demo.sh is disabled.

Demo is a frozen presentation environment. It must not deploy latestCommit,
force-push a branch, or deploy directly from a developer checkout.

Promote the immutable `staging-deployed` SHA with the guarded GitHub Actions
workflow `Railway Deploy` and select the `demo` environment. The workflow
requires `confirm_demo=yes`, validates demo.consultify.ai, and deploys the
detached commit referenced by the staging tag.
EOF

exit 2
