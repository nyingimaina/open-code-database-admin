#!/bin/bash
# Create GitHub repo and push

REPO_NAME="database-admin"
GITHUB_USER="nyingimaina"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    echo ""
    echo "Then run:"
    echo "  gh auth login"
    echo "  gh repo create $REPO_NAME --public --source=. --push"
    exit 1
fi

# Authenticate if needed
gh auth status || gh auth login

# Create repo
gh repo create "$REPO_NAME" --public --source=. --push

echo ""
echo "Repository created: https://github.com/$GITHUB_USER/$REPO_NAME"
