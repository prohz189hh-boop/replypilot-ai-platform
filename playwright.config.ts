import { defineConfig,devices } from '@playwright/test';
import path from 'node:path';
const testDataDir=process.env.REPLYPILOT_E2E_DATA_DIR||path.resolve('work','e2e-'+Date.now());
process.env.REPLYPILOT_E2E_DATA_DIR=testDataDir;
export default defineConfig({testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:90000,expect:{timeout:15000},reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:3100',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1100}}}],webServer:{command:'node scripts/local.mjs start',url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:90000,env:{PORT:'3100',REPLYPILOT_DATA_DIR:testDataDir}}});
