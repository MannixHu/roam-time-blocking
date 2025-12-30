#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Building extension..."
npm run build

echo "Build complete! Output: build/extension.js"
