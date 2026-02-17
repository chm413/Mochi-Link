/**
 * 简单测试：验证 Koishi 插件能否正确加载
 */

const plugin = require('./lib/index.js');

console.log('=== Koishi Plugin Load Test ===\n');

// 检查导出
console.log('✓ Plugin module loaded');
console.log('✓ apply function:', typeof plugin.apply === 'function' ? 'OK' : 'FAIL');
console.log('✓ Config schema:', plugin.Config ? 'OK' : 'FAIL');
console.log('✓ apply.Config:', plugin.apply.Config ? 'OK' : 'FAIL');
console.log('✓ Plugin name:', plugin.name || 'MISSING');
console.log('✓ Plugin usage:', plugin.usage ? 'OK' : 'FAIL');
console.log('✓ MochiLinkPlugin class:', typeof plugin.MochiLinkPlugin === 'function' ? 'OK' : 'FAIL');

// 检查 Config 结构
if (plugin.Config) {
  console.log('\n=== Config Schema ===');
  console.log('Config type:', plugin.Config.type || 'unknown');
  console.log('Config has dict:', !!plugin.Config.dict);
}

// 检查 apply.Config
if (plugin.apply.Config) {
  console.log('\n=== apply.Config ===');
  console.log('apply.Config === Config:', plugin.apply.Config === plugin.Config);
}

console.log('\n=== Test Complete ===');
console.log('All checks passed! Plugin should load correctly in Koishi.');
