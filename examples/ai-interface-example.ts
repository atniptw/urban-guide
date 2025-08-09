/**
 * Example of using the AI Interface with a simple workflow
 * This demonstrates how the ManualInterface works in practice
 */

import { WorkflowEngine } from '../src/engine/workflow-engine';
import { StateManager } from '../src/state/state-manager';
import { StepExecutor } from '../src/engine/step-executor';
import { ManualInterface } from '../src/ai/manual-interface';
import { TemplateEngine } from '../src/templates/template-engine';
import { Workflow } from '../src/core/types';

async function runAIWorkflowExample() {
  console.log('🚀 AI Interface Example - Manual Copy-Paste Mode\n');

  // Create AI interface and other components
  const aiInterface = new ManualInterface(60000); // 1 minute timeout
  const templateEngine = new TemplateEngine();
  const stepExecutor = new StepExecutor(templateEngine, aiInterface);
  const stateManager = new StateManager();
  const workflowEngine = new WorkflowEngine(stateManager, stepExecutor);

  // Define a simple workflow with AI interaction
  const workflow: Workflow = {
    id: 'ai-example-workflow',
    name: 'AI Interface Example',
    description: 'Demonstrates AI interface integration',
    version: '1.0.0',
    inputs: [
      {
        name: 'task_description',
        type: 'string',
        description: 'Description of the task to perform',
        required: true,
      },
    ],
    steps: [
      {
        id: 'analyze-task',
        type: 'ai-prompt',
        agent: 'tech-lead',
        template: `As a technical lead, analyze the following task and provide a structured breakdown:

Task: {{task_description}}

Please provide:
1. Key requirements analysis
2. Technical approach recommendation
3. Potential challenges and solutions
4. Next steps

Format your response clearly with numbered sections.`,
        model: 'gpt-4',
        temperature: 0.7,
      },
      {
        id: 'create-implementation-plan',
        type: 'ai-prompt',
        agent: 'developer',
        template: `Based on the tech lead analysis, create a detailed implementation plan:

Analysis: {{ai_response}}

Please create:
1. Step-by-step implementation plan
2. Code structure recommendations
3. Testing strategy
4. Timeline estimation

Be specific and actionable.`,
        model: 'gpt-4',
        temperature: 0.5,
      },
    ],
    outputs: [
      {
        name: 'tech_analysis',
        type: 'string',
        description: 'Technical analysis from the tech lead',
      },
      {
        name: 'implementation_plan',
        type: 'string',
        description: 'Detailed implementation plan from developer',
      },
    ],
  };

  try {
    // Execute the workflow
    const result = await workflowEngine.execute(workflow, {
      task_description: 'Implement a real-time chat feature for a web application',
    });

    console.log('\n✅ Workflow completed successfully!');
    console.log('\n📊 Results:');
    console.log('Session ID:', result.sessionId);
    console.log('Status:', result.status);
    console.log('Steps completed:', result.stepHistory?.length || 0);

    // Display the AI outputs
    if (result.outputs) {
      console.log('\n🤖 AI Generated Content:');
      console.log('='.repeat(50));
      
      Object.entries(result.outputs).forEach(([key, value]) => {
        if (typeof value === 'string' && key.includes('ai_response')) {
          console.log(`\n📝 ${key}:`);
          console.log('-'.repeat(30));
          console.log(value);
        }
      });
    }

    console.log('\n🎉 Example completed successfully!');
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
  } finally {
    // Clean up
    aiInterface.close();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runAIWorkflowExample().catch(console.error);
}

export { runAIWorkflowExample };