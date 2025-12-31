#!/bin/bash

echo "=================================="
echo "Cleaning up corrupted files"
echo "=================================="
echo ""

# Remove Docker build artifacts that shouldn't be files
echo "Removing Docker build artifacts..."

# List of files to remove (Docker build output that became files)
rm -f '='
rm -f ']'
rm -f '[--include'
rm -f '[--omit'
rm -f '[backend'
rm -f 'ERROR'
rm -f 'extracting'
rm -f 'resolve'
rm -f 'transferring'
rm -f sha256:*

echo "✓ Cleaned up corrupted files"
echo ""

# Verify .env.example exists
echo "Checking for .env.example..."
if [ -f .env.example ]; then
    echo "✓ .env.example found"
else
    echo "✗ .env.example missing - restoring from git"
    git checkout .env.example
fi

echo ""
echo "=================================="
echo "Cleanup complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Create your .env file: cp .env.example .env"
echo "2. Edit .env and add your GROK_API_KEY"
echo "3. Run: sudo docker-compose up -d --build"
echo ""
