# Workflow Definitions

This directory contains YAML workflow definitions for the AI Workflow Orchestrator. These workflows demonstrate complete, real-world use cases and can be used as templates for custom workflows.

## Available Workflows

### 🔍 Tech Lead Feature Analysis (`tech-lead-feature-analysis.yaml`)

A comprehensive workflow that automates the feature analysis process typically performed by a technical lead.

**Purpose**: Analyze GitHub issues, identify requirements gaps, and break down features into actionable development tasks with automated GitHub issue creation.

**Key Features**:
- 🔗 **GitHub Integration**: Fetches issue data using GitHub SDK
- 🤖 **AI-Powered Analysis**: Uses tech-lead agent for requirements analysis  
- ❓ **Gap Identification**: Automatically identifies missing requirements
- 📝 **Task Breakdown**: Creates detailed development tasks
- 🎯 **Issue Creation**: Automatically creates GitHub issues for tasks
- 🔄 **Error Handling**: Comprehensive retry logic and validation
- ⚡ **Rate Limiting**: Respects GitHub API limits

**Input Requirements**:
- `github_issue_url`: Full GitHub issue URL (required)
- `github_token`: GitHub Personal Access Token (optional if `GITHUB_TOKEN` env var set)
- `target_repository`: Target repo for task issues (optional, defaults to source repo)

**Expected Outputs**:
- Complete requirements analysis
- List of clarification questions (if gaps found)
- Created GitHub issues for development tasks
- Comprehensive analysis summary

**Example Usage**:
```bash
# Set up GitHub token
export GITHUB_TOKEN=your_token_here

# Run the workflow
aiflow run tech-lead-feature-analysis \
  --input github_issue_url=https://github.com/owner/repo/issues/123
```

**Workflow Steps**:
1. **Validate GitHub Auth** - Verify token and rate limits
2. **Fetch Issue** - Retrieve comprehensive issue data
3. **Analyze Requirements** - AI analysis of feature requirements
4. **Identify Gaps** - Find missing or unclear requirements
5. **Handle Gaps** - Generate clarification questions if needed
6. **Create Tasks** - Break down into development tasks
7. **Create Issues** - Generate GitHub issues for tasks
8. **Generate Summary** - Comprehensive analysis report

## Using Workflows

### Prerequisites

1. **Environment Setup**:
   ```bash
   # GitHub integration
   export GITHUB_TOKEN=your_personal_access_token
   
   # Optional: Configure default repository
   export DEFAULT_GITHUB_REPO=owner/repo
   ```

2. **Required Dependencies**:
   - `@octokit/rest` - GitHub SDK integration
   - Proper AI interface configuration (manual or API)

### Running Workflows

```bash
# List available workflows
aiflow list workflows

# Run a specific workflow
aiflow run <workflow-id> [options]

# Run with custom inputs
aiflow run tech-lead-feature-analysis \
  --input github_issue_url=https://github.com/owner/repo/issues/123 \
  --input target_repository.owner=different-owner \
  --input target_repository.repo=different-repo
```

### Workflow Development

#### YAML Structure

All workflows follow this basic structure:

```yaml
id: unique-workflow-identifier
name: Human Readable Name
version: 1.0.0
description: Detailed description of the workflow purpose

# Define expected inputs
inputs:
  input_name:
    type: string|number|boolean|object|array
    description: Clear description
    required: true|false
    default: optional_default_value

# Define expected outputs  
outputs:
  output_name:
    type: string|object|array
    description: What this output contains

# Workflow execution variables
variables:
  var_name: default_value

# Sequential steps
steps:
  - id: step-identifier
    type: ai-prompt|script|conditional|loop
    name: Human readable step name
    # ... step-specific configuration
```

#### Step Types

1. **AI Prompt Steps** (`ai-prompt`):
   ```yaml
   - id: analyze-data
     type: ai-prompt
     agent: tech-lead
     template: |
       Your analysis instructions here...
       Context: {{variable_name}}
   ```

2. **Script Steps** (`script`):
   ```yaml
   - id: process-data
     type: script
     script: |
       // JavaScript code
       const result = processData(context.inputs.data);
       return result;
   ```

3. **Conditional Steps** (`conditional`):
   ```yaml
   - id: conditional-logic
     type: conditional
     condition: "variable_name === 'expected_value'"
     steps:
       - id: conditional-step
         type: ai-prompt
         # ... nested steps
   ```

#### Best Practices

1. **Error Handling**:
   ```yaml
   on_error:
     action: fail|retry|continue
     max_retries: 2
     message: "Clear error description"
   ```

2. **Input Validation**:
   ```yaml
   inputs:
     github_url:
       type: string
       validation:
         pattern: '^https://github\.com/.+$'
         error_message: "Must be valid GitHub URL"
   ```

3. **Output Mapping**:
   ```yaml
   outputs:
     processed_data: "response.content | fromjson"
   ```

4. **Variable Usage**:
   ```yaml
   variables:
     api_response: {}
   steps:
     - id: fetch-data
       outputs:
         api_response: "$.data"
   ```

## Integration Examples

### GitHub Integration

```javascript
const { GitHubIntegration } = require('../src/integrations/github');

const github = new GitHubIntegration({ token: process.env.GITHUB_TOKEN }, logger);

// Fetch issue
const issue = await github.fetchIssue(issueUrl);

// Create multiple issues
const createdIssues = await github.createMultipleIssues(repository, issueOptions);
```

### Agent Integration

```yaml
- id: analysis-step
  type: ai-prompt
  agent: tech-lead  # Uses configured tech-lead agent
  template: |
    Analyze this requirement: {{requirement}}
  outputs:
    analysis: "response.content"
```

## Troubleshooting

### Common Issues

1. **GitHub Authentication Errors**:
   - Verify `GITHUB_TOKEN` environment variable
   - Check token permissions (repo access required)
   - Verify rate limits with `gh api rate_limit`

2. **Workflow Loading Errors**:
   - Validate YAML syntax
   - Check required inputs are provided
   - Verify step dependencies

3. **AI Agent Errors**:
   - Ensure agents are properly configured
   - Check AI interface is working
   - Verify agent capabilities match step requirements

### Debug Mode

Run workflows with debug logging:
```bash
aiflow run workflow-id --debug --log-level debug
```

## Contributing

When creating new workflows:

1. Follow the established YAML schema
2. Include comprehensive error handling
3. Provide clear documentation in the workflow description
4. Test with real-world scenarios
5. Include usage examples in this README

## Related Documentation

- [Design Specification](../docs/design-spec.md) - Complete system design
- [Agent Configurations](../src/agents/default-agents.yaml) - Available AI agents
- [Core Types](../src/core/types.ts) - TypeScript interfaces
- [GitHub Integration](../src/integrations/github.ts) - GitHub SDK wrapper