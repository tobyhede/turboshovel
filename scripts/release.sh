#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Usage
usage() {
    echo "Usage: $0 <version-type> [--dry-run] [--skip-tests] [--skip-publish]"
    echo ""
    echo "Version types:"
    echo "  patch    - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  minor    - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  major    - Bump major version (1.0.0 -> 2.0.0)"
    echo "  <x.y.z>  - Set explicit version"
    echo ""
    echo "Options:"
    echo "  --dry-run       Show what would be done without making changes"
    echo "  --skip-tests    Skip running tests (not recommended)"
    echo "  --skip-publish  Build and tag but don't publish to npm"
    echo ""
    echo "Examples:"
    echo "  $0 patch"
    echo "  $0 minor --dry-run"
    echo "  $0 1.2.3"
    exit 1
}

# Parse arguments
VERSION_TYPE=""
DRY_RUN=false
SKIP_TESTS=false
SKIP_PUBLISH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-publish)
            SKIP_PUBLISH=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -z "$VERSION_TYPE" ]]; then
                VERSION_TYPE="$1"
            else
                echo -e "${RED}Error: Unknown argument '$1'${NC}"
                usage
            fi
            shift
            ;;
    esac
done

if [[ -z "$VERSION_TYPE" ]]; then
    echo -e "${RED}Error: Version type required${NC}"
    usage
fi

# Get current version from shared package (source of truth)
CURRENT_VERSION=$(node -p "require('./packages/shared/package.json').version")

# Calculate new version
calculate_new_version() {
    local current="$1"
    local type="$2"

    IFS='.' read -r major minor patch <<< "$current"

    case "$type" in
        patch)
            echo "$major.$minor.$((patch + 1))"
            ;;
        minor)
            echo "$major.$((minor + 1)).0"
            ;;
        major)
            echo "$((major + 1)).0.0"
            ;;
        *)
            # Assume explicit version
            if [[ "$type" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "$type"
            else
                echo ""
            fi
            ;;
    esac
}

NEW_VERSION=$(calculate_new_version "$CURRENT_VERSION" "$VERSION_TYPE")

if [[ -z "$NEW_VERSION" ]]; then
    echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
    usage
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Turboshovel Release Script${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo -e "New version:     ${GREEN}$NEW_VERSION${NC}"
echo ""

if $DRY_RUN; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}Error: Working directory has uncommitted changes${NC}"
    echo "Please commit or stash changes before releasing."
    git status --short
    exit 1
fi

# Check we're on main or a release branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && ! "$CURRENT_BRANCH" =~ ^release/ ]]; then
    echo -e "${YELLOW}Warning: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update version in all package.json files
update_versions() {
    local version="$1"
    local packages=(
        "packages/shared/package.json"
        "packages/cli/package.json"
        "plugin/core/package.json"
    )

    for pkg in "${packages[@]}"; do
        echo -e "  Updating ${BLUE}$pkg${NC}"
        if ! $DRY_RUN; then
            # Use node to update version to preserve formatting
            node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
                pkg.version = '$version';
                fs.writeFileSync('$pkg', JSON.stringify(pkg, null, 2) + '\n');
            "
        fi
    done
}

# Build all packages
build_packages() {
    echo -e "\n${BLUE}Building packages...${NC}"
    if ! $DRY_RUN; then
        npm run build
    else
        echo "  [dry-run] npm run build"
    fi
}

# Run tests
run_tests() {
    echo -e "\n${BLUE}Running tests...${NC}"
    if ! $DRY_RUN; then
        npm run test
        npm run lint
    else
        echo "  [dry-run] npm run test"
        echo "  [dry-run] npm run lint"
    fi
}

# Publish packages
publish_packages() {
    local packages=(
        "packages/shared"
        "packages/cli"
        "plugin/core"
    )

    echo -e "\n${BLUE}Publishing packages to npm...${NC}"

    for pkg_dir in "${packages[@]}"; do
        local pkg_name=$(node -p "require('./$pkg_dir/package.json').name")
        echo -e "  Publishing ${GREEN}$pkg_name${NC}"
        if ! $DRY_RUN; then
            (cd "$pkg_dir" && npm publish --access public)
        else
            echo "    [dry-run] cd $pkg_dir && npm publish --access public"
        fi
    done
}

# Create git tag
create_tag() {
    local version="$1"
    local tag="v$version"

    echo -e "\n${BLUE}Creating git tag ${GREEN}$tag${NC}"

    if ! $DRY_RUN; then
        git add packages/shared/package.json packages/cli/package.json plugin/core/package.json
        git commit -m "chore: release v$version"
        git tag -a "$tag" -m "Release $tag"
        echo -e "\n${YELLOW}Don't forget to push:${NC}"
        echo "  git push && git push --tags"
    else
        echo "  [dry-run] git add ..."
        echo "  [dry-run] git commit -m 'chore: release v$version'"
        echo "  [dry-run] git tag -a $tag -m 'Release $tag'"
    fi
}

# Main release flow
echo -e "${BLUE}Step 1/5: Updating versions...${NC}"
update_versions "$NEW_VERSION"

echo -e "\n${BLUE}Step 2/5: Building packages...${NC}"
build_packages

if ! $SKIP_TESTS; then
    echo -e "\n${BLUE}Step 3/5: Running tests...${NC}"
    run_tests
else
    echo -e "\n${YELLOW}Step 3/5: Skipping tests (--skip-tests)${NC}"
fi

if ! $SKIP_PUBLISH; then
    echo -e "\n${BLUE}Step 4/5: Publishing to npm...${NC}"
    publish_packages
else
    echo -e "\n${YELLOW}Step 4/5: Skipping publish (--skip-publish)${NC}"
fi

echo -e "\n${BLUE}Step 5/5: Creating git tag...${NC}"
create_tag "$NEW_VERSION"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Release v$NEW_VERSION complete!${NC}"
echo -e "${GREEN}======================================${NC}"

if $DRY_RUN; then
    echo ""
    echo -e "${YELLOW}This was a dry run. Run without --dry-run to execute.${NC}"
fi
