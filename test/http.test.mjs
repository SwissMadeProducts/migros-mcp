import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
let child, client;
before(async () => {
  child = spawn(process.execPath, ['dist/http.js'], {env: {...process.env, PORT:String(port), MIGROS_EMAIL:'unused', MIGROS_PASSWORD:'unused'},stdio:'pipe'});
  for(let i=0;i<100;i++) {
    try { if((await fetch(`${base}/health`)).ok) break; } catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  client = new Client({name:'http-regression',version:'1.0.0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
});
after(async()=>{await client?.close();child?.kill();});
test('only the eight anonymous read-only tools are exposed even when credentials exist',async()=>{
  const {tools}=await client.listTools();
  assert.deepEqual(tools.map(t=>t.name).sort(), ['search_products','get_product_details','get_stock','search_stores','get_promotions','search_recipes','get_recipe_details','get_recipe_products'].sort());
  assert.ok(tools.every(t=>t.annotations.readOnlyHint && !t.annotations.destructiveHint));
  assert.equal((await client.callTool({name:'get_profile',arguments:{}})).isError,true);
});
test('rejects malformed, oversized, and cross-origin requests',async()=>{
  const post=(body,headers={})=>fetch(`${base}/mcp`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  assert.equal((await post('{')).status,400);
  assert.equal((await post(JSON.stringify({big:'x'.repeat(70000)}))).status,413);
  assert.equal((await post('{}',{Origin:'https://untrusted.example'})).status,403);
  const status=await new Promise((resolve,reject)=>{const r=request(`${base}/mcp`,{method:'POST',headers:{Host:'untrusted.example','Content-Type':'application/json'}},s=>{s.resume();resolve(s.statusCode)});r.on('error',reject);r.end('{}');});
  assert.equal(status,403);
  assert.equal((await fetch(`${base}/mcp`)).status,405);
});
test('bounds product detail batch sizes before reaching upstream',async()=>{
  const r=await client.callTool({name:'get_product_details',arguments:{productIds:Array(51).fill('1')}});
  assert.equal(r.isError,true);
});
