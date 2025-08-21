// ===================================================================
// TEST WORKFLOW STRUCTURE
// Check if the workflow has all required class_type properties
// ===================================================================

const fs = require('fs');
const path = require('path');

// Read the workflow file
const workflowPath = path.join(__dirname, 'Workflows', 'Socialtwin-Image.json');
const workflowContent = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(workflowContent);

console.log('=== WORKFLOW VALIDATION ===');

// Check each node for class_type
let hasErrors = false;
for (const [nodeId, nodeData] of Object.entries(workflow)) {
  if (typeof nodeData === 'object' && nodeData !== null) {
    if (!nodeData.class_type) {
      console.error(`❌ Node ${nodeId} missing class_type:`, nodeData);
      hasErrors = true;
    } else {
      console.log(`✅ Node ${nodeId}: ${nodeData.class_type}`);
    }
  }
}

if (!hasErrors) {
  console.log('\n🎉 All nodes have class_type property!');
  console.log('\n=== TESTING PROMPT INJECTION ===');
  
  // Test prompt injection (what the API does)
  const testPrompt = "Test prompt for image generation";
  if (workflow['6']?.inputs) {
    workflow['6'].inputs.text = testPrompt;
    console.log(`✅ Prompt injected into node 6: ${testPrompt}`);
  } else {
    console.error('❌ Node 6 not found or missing inputs');
  }
  
  // Check if workflow is still valid after modification
  console.log('\n=== FINAL WORKFLOW STRUCTURE ===');
  console.log('Node 6 inputs:', JSON.stringify(workflow['6']?.inputs, null, 2));
} else {
  console.log('\n❌ Workflow has structural issues!');
}

console.log('\n=== SUMMARY ===');
console.log(`Total nodes: ${Object.keys(workflow).length}`);
console.log(`Errors found: ${hasErrors ? 'YES' : 'NO'}`);
