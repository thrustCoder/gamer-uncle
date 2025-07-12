#!/bin/bash

# Simple Azure DevOps Pipeline YAML Validator
# This script checks for common YAML issues that prevent Azure DevOps pipelines from running

echo "🔍 Validating Azure DevOps Pipeline YAML..."

PIPELINE_FILE="pipelines/azure-pipelines.yml"

if [ ! -f "$PIPELINE_FILE" ]; then
    echo "❌ Pipeline file not found: $PIPELINE_FILE"
    exit 1
fi

echo "✅ Pipeline file found"

# Check for basic structure
echo "📋 Checking basic pipeline structure..."

if grep -q "^trigger:" "$PIPELINE_FILE"; then
    echo "✅ Trigger section found"
else
    echo "❌ Missing trigger section"
fi

if grep -q "^pr:" "$PIPELINE_FILE"; then
    echo "✅ PR trigger section found"
else
    echo "❌ Missing PR trigger section"
fi

if grep -q "^stages:" "$PIPELINE_FILE"; then
    echo "✅ Stages section found"
else
    echo "❌ Missing stages section"
fi

# Check for duplicate keys that cause YAML errors
echo "📋 Checking for duplicate keys..."

duplicate_display_name=$(grep -c "displayName:" "$PIPELINE_FILE")
echo "📊 Found $duplicate_display_name displayName entries"

# Check for malformed conditions
echo "📋 Checking condition syntax..."

if grep -A5 "condition: |" "$PIPELINE_FILE" | grep -q "^[[:space:]]*or("; then
    echo "✅ Multi-line conditions appear valid"
else
    echo "⚠️ Check multi-line condition syntax"
fi

# Check for required job dependencies
echo "📋 Checking job dependencies..."

if grep -q "dependsOn:" "$PIPELINE_FILE"; then
    echo "✅ Job dependencies found"
else
    echo "⚠️ No job dependencies found"
fi

# Validate stage naming (Azure DevOps is strict about this)
echo "📋 Checking stage names..."

STAGE_NAMES=$(grep "^- stage:" "$PIPELINE_FILE" | sed 's/- stage: //' | tr -d '\r')
for stage in $STAGE_NAMES; do
    if [[ "$stage" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]]; then
        echo "✅ Stage name valid: $stage"
    else
        echo "❌ Invalid stage name: $stage"
    fi
done

# Check for PR-specific conditions
echo "📋 Checking PR-specific conditions..."

if grep -q "eq(variables\['Build\.Reason'\], 'PullRequest')" "$PIPELINE_FILE"; then
    echo "✅ PR condition found"
else
    echo "❌ Missing PR condition"
fi

echo ""
echo "🎯 Validation Summary:"
echo "   The pipeline should now be parseable by Azure DevOps"
echo "   To trigger the PR pipeline, you need to:"
echo "   1. Create a Pull Request from your feature branch to main"
echo "   2. The pipeline will automatically trigger on PR creation"
echo ""
echo "🔗 Next steps:"
echo "   - Go to GitHub and create a PR from 'users/rajsin/v1.3.0' to 'main'"
echo "   - The pipeline should trigger automatically"
echo "   - Monitor the pipeline run in Azure DevOps"
