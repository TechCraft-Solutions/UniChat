#!/bin/bash
set -e

# Synchronize version across package.json, Cargo, Tauri, Flatpak, and optional Angular environment.
# Usage: ./scripts/sync-versions.sh <new-version>

if [ $# -eq 0 ]; then
	echo "Usage: $0 <new-version>"
	echo "Example: $0 1.0.0"
	exit 1
fi

NEW_VERSION="$1"
CURRENT_DATE=$(date +%Y-%m-%d)

echo "Synchronizing version to: $NEW_VERSION"
echo "Release date: $CURRENT_DATE"

if [ -f "package.json" ]; then
	sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json
	echo "✓ Updated package.json"
fi

if [ -f "src-tauri/Cargo.toml" ]; then
	sed -i '0,/^version = "[^"]*"/s/version = "[^"]*"/version = "'"$NEW_VERSION"'"/' src-tauri/Cargo.toml
	echo "✓ Updated src-tauri/Cargo.toml"
fi

if [ -f "src-tauri/tauri.conf.json" ]; then
	sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
	echo "✓ Updated src-tauri/tauri.conf.json"
fi

if [ -f "src/environments/environment.ts" ]; then
	sed -i "s/version: '[^']*'/version: '$NEW_VERSION'/" src/environments/environment.ts
	sed -i "s/version: \"[^\"]*\"/version: \"$NEW_VERSION\"/" src/environments/environment.ts
	echo "✓ Updated src/environments/environment.ts"
fi

update_metainfo() {
	local metainfo_file="$1"

	if [ ! -f "$metainfo_file" ]; then
		return
	fi

	if grep -q "version=\"$NEW_VERSION\"" "$metainfo_file"; then
		echo "⚠ Release version $NEW_VERSION already exists in $metainfo_file"
		return
	fi

	cp "$metainfo_file" "${metainfo_file}.bak"

	awk -v version="$NEW_VERSION" -v date="$CURRENT_DATE" '
		/<releases>/ {
				print $0
				print "    <release version=\"" version "\" date=\"" date "\">"
				print "      <description>"
				print "        <p>Release version " version "</p>"
				print "      </description>"
				print "    </release>"
				next
		}
		{ print }
	' "${metainfo_file}.bak" >"$metainfo_file"

	rm -f "${metainfo_file}.bak"
	echo "✓ Updated $metainfo_file with new release"
}

METAINFO="flatpak/com.tcs.unichat.metainfo.xml"
if [ -f "$METAINFO" ]; then
	update_metainfo "$METAINFO"
fi

echo ""
echo "✓ Version synchronization completed ($NEW_VERSION)"
