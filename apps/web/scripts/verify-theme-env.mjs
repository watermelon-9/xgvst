#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const envExamplePath = path.resolve(process.cwd(), '.env.example');
const envExample = fs.readFileSync(envExamplePath, 'utf-8');

function resolveThemeModeFromEnv(raw) {
	const normalized = String(raw ?? '').trim().toLowerCase();
	if (normalized === 'finance-light' || normalized === 'light') return 'light';
	if (normalized === 'finance-dark' || normalized === 'dark') return 'dark';
	return 'system';
}

const matrix = [
	{ input: 'system', expected: 'system' },
	{ input: 'finance-light', expected: 'light' },
	{ input: 'finance-dark', expected: 'dark' },
	{ input: 'LIGHT', expected: 'light' },
	{ input: 'unknown-value', expected: 'system' },
	{ input: '', expected: 'system' }
];

let failed = false;

if (!envExample.includes('PUBLIC_THEME=system')) {
	failed = true;
	console.error('❌ .env.example missing PUBLIC_THEME=system');
} else {
	console.log('✅ .env.example includes PUBLIC_THEME=system');
}

for (const item of matrix) {
	const actual = resolveThemeModeFromEnv(item.input);
	const pass = actual === item.expected;
	if (!pass) failed = true;
	console.log(`${pass ? '✅' : '❌'} input="${item.input}" => ${actual} (expected ${item.expected})`);
}

if (failed) {
	process.exit(1);
}

console.log('🎉 theme env verify passed');
