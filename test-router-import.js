// Test if router can be imported
try {
  const { APIRouter } = require('./src/http/router.ts');
  console.log('Router imported successfully:', APIRouter);
} catch (error) {
  console.error('Failed to import router:', error.message);
}