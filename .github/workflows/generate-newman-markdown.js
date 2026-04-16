const fs = require('fs');
const path = require('path');

function escapeTableValue(value) {
  const text = String(value ?? 'N/A');
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function toUrl(url) {
  if (!url) return 'N/A';
  if (typeof url === 'string') return url;
  if (typeof url.toString === 'function') return url.toString();
  return JSON.stringify(url);
}

function getDurationMs(started, completed) {
  const startedMs = started ? new Date(started).getTime() : null;
  const completedMs = completed ? new Date(completed).getTime() : null;
  return Number.isFinite(startedMs) && Number.isFinite(completedMs) ? completedMs - startedMs : 'N/A';
}

function replaceTokens(template, replacements) {
  return Object.entries(replacements).reduce((content, [token, value]) => {
    const safeValue = value == null ? '' : String(value);
    return content.replaceAll(`{{${token}}}`, safeValue);
  }, template);
}

function buildTestStepRows(executions, failuresByName) {
  if (!executions.length) {
    return '| 1 | No execution data | N/A | N/A | N/A | N/A | FAIL | N/A | Medium |';
  }

  return executions.map((execution, index) => {
    const itemName = execution.item?.name || 'Unnamed request';
    const method = execution.request?.method || 'N/A';
    const url = toUrl(execution.request?.url);
    const responseCode = execution.response?.code ?? 'N/A';
    const responseText = execution.response?.status ?? '';
    const responseTime = execution.response?.responseTime ?? 'N/A';
    const assertionCount = Array.isArray(execution.assertions) ? execution.assertions.length : 0;
    const relatedFailures = failuresByName.get(itemName) || [];
    const passFail = relatedFailures.length === 0 ? 'PASS' : 'FAIL';
    const bugId = relatedFailures.length > 0 ? `BUG-${String(index + 1).padStart(3, '0')}` : 'N/A';
    const severity = relatedFailures.length > 0 ? 'Medium' : 'N/A';
    const actual = relatedFailures.length > 0
      ? relatedFailures.map((f) => f.error?.message || 'Error').join(' ; ')
      : `${responseCode} ${responseText}`.trim();

    return `| ${index + 1} | ${escapeTableValue(`${method} ${itemName}`)} | ${escapeTableValue(url)} | ${escapeTableValue('Request returns successful response and expected behavior')} | ${escapeTableValue(actual)} | ${escapeTableValue(`Response time: ${responseTime}ms, Assertions: ${assertionCount}`)} | ${passFail} | ${bugId} | ${severity} |`;
  }).join('\n');
}

function buildFailuresByName(failures) {
  const map = new Map();
  failures.forEach((failure) => {
    const name = failure?.source?.name || 'Unknown request';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(failure);
  });
  return map;
}

function generateNewmanMarkdown(inputPath = 'reports/newman-report.json', outputPath = 'reports/newman-report.md') {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing Newman JSON report at ${inputPath}`);
  }

  const templateDir = path.join('reports', 'templates');
  const testCaseTemplatePath = path.join(templateDir, 'Software Test Case Sheet template.md');
  const bugTemplatePath = path.join(templateDir, 'Buf report Template.md');

  if (!fs.existsSync(testCaseTemplatePath)) {
    throw new Error(`Missing template file at ${testCaseTemplatePath}`);
  }
  if (!fs.existsSync(bugTemplatePath)) {
    throw new Error(`Missing template file at ${bugTemplatePath}`);
  }

  const testCaseTemplate = fs.readFileSync(testCaseTemplatePath, 'utf8');
  const bugTemplate = fs.readFileSync(bugTemplatePath, 'utf8');

  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const run = report.run || {};
  const stats = run.stats || {};
  const timings = run.timings || {};
  const executions = Array.isArray(run.executions) ? run.executions : [];
  const failures = Array.isArray(run.failures) ? run.failures : [];
  const totalRequests = stats.requests?.total ?? 0;
  const failedRequests = stats.requests?.failed ?? 0;
  const totalAssertions = stats.assertions?.total ?? 0;
  const failedAssertions = stats.assertions?.failed ?? 0;

  const failuresByName = buildFailuresByName(failures);
  const testStepRows = buildTestStepRows(executions, failuresByName);

  const firstExecution = executions[0] || {};
  const firstMethod = firstExecution.request?.method || 'API';
  const firstItemName = firstExecution.item?.name || 'Collection run';
  const appUrl = toUrl(firstExecution.request?.url);

  const testCaseContent = replaceTokens(testCaseTemplate, {
    TEST_CASE_TITLE: `${report.collection?.name ?? 'Newman Collection'} - Automated API Regression`,
    STC_ID: `STC-${new Date().toISOString().slice(0, 10)}`,
    USER_STORY: `Validate API behavior for collection ${report.collection?.name ?? 'N/A'}`,
    PURPOSE: `Execute Newman collection and verify request reliability, timing, and failure status (${failedRequests}/${totalRequests} request failures).`,
    APP_VERSION: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 8) : 'N/A',
    DATES_OF_TEST: `${formatDate(timings.started)} -> ${formatDate(timings.completed)}`,
    BROWSER: 'N/A (API test)',
    DATABASE: 'N/A',
    TEST_TYPE: 'API Automation / Regression',
    PRIORITY: failedRequests > 0 ? 'High' : 'Medium',
    OS: process.platform,
    SERVER: appUrl,
    PRECONDITIONS: `Postman collection and environment configured; Newman installed in CI; Total assertions: ${totalAssertions}.`,
    REQUIRED_INFO: `Newman JSON: ${inputPath}`,
    NOTES: `Run duration: ${getDurationMs(timings.started, timings.completed)} ms. Failed assertions: ${failedAssertions}.`,
    SCRIPT_TITLE: `${firstMethod} ${firstItemName}`,
    TEST_STEP_ROWS: testStepRows
  });

  const bugSections = failures.map((failure, index) => {
    const source = failure.source || {};
    const error = failure.error || {};
    const bugId = `BUG-${String(index + 1).padStart(3, '0')}`;
    const itemName = source.name || 'Unknown request';
    const testName = source.test || 'N/A';
    const message = error.message || 'N/A';
    const stack = error.stack || 'N/A';
    const matchingExecution = executions.find((e) => (e.item?.name || 'Unknown request') === itemName);
    const failureUrl = matchingExecution ? toUrl(matchingExecution.request?.url) : 'N/A';

    return replaceTokens(bugTemplate, {
      BUG_AUTO_ID: bugId,
      BUG_TITLE: `${itemName} - ${message}`,
      SUBMIT_DATE: formatDate(timings.completed || new Date().toISOString()),
      SUMMARY: `Failure detected in automated Newman run for request "${itemName}".`,
      TEST_DATA: `Test Name: ${testName}`,
      APP_URL: failureUrl,
      SCREENSHOT_NOTE: 'See HTML report artifact for request/response details.',
      PLATFORM: 'GitHub Actions',
      OPERATING_SYSTEM: 'ubuntu-latest',
      BROWSER_NAME: 'N/A (API test)',
      PRECONDITION: 'Collection executed through Newman in CI pipeline.',
      STEPS_TO_REPRODUCE: `1. Run Newman collection.\n2. Execute request "${itemName}".\n3. Observe error message.`,
      EXPECTED_RESULT: 'Request completes successfully with expected response.',
      ACTUAL_RESULT: `${message}. Stack: ${stack}`,
      NOTES: `Failure source index: ${source.name ? itemName : 'N/A'}.`
    });
  });

  const finalContentParts = [testCaseContent];
  if (bugSections.length > 0) {
    finalContentParts.push('---\n');
    finalContentParts.push('# Bug Reports');
    finalContentParts.push('');
    finalContentParts.push(...bugSections);
  }

  fs.writeFileSync(outputPath, `${finalContentParts.join('\n')}\n`);
}

if (require.main === module) {
  const inputPath = process.argv[2] || 'reports/newman-report.json';
  const outputPath = process.argv[3] || 'reports/newman-report.md';
  generateNewmanMarkdown(inputPath, outputPath);
}

module.exports = { generateNewmanMarkdown };
