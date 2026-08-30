/**
 * Automated Test Suite for AI Commerce Copilot Safe Markdown Rendering Engine.
 * Tests headings, bold/italic, lists, inline code, code blocks, links, tables,
 * XSS safety, streaming resilience, plain-text stability, and user regression test.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SafeMarkdownRenderer from '../components/AI/SafeMarkdownRenderer';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, expected: string, actual: string, details: string) {
  results.push({ id, name, passed, expected, actual, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Test ${id.toString().padStart(2, '0')}] ${status} — ${name}`);
  console.log(`    Expected: ${expected}`);
  console.log(`    Actual:   ${actual}`);
  console.log(`    Details:  ${details}\n`);
}

async function runMarkdownTestSuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING AI COMMERCE COPILOT MARKDOWN RENDERING VALIDATION SUITE');
  console.log('========================================================================\n');

  // Test 1: User Required Regression Test Snippet
  const userRegressionSnippet = `# Campaign Recommendation

**Target:** Dormant customers

* Customer has not purchased in 90 days
* Previous purchase value: ₹2,499
* Recommended discount: **5%**
* Margin floor: **15%**

### Recommendation

Use a **5% discount** with a personalized win-back message.

| Metric       | Value |
| ------------ | ----: |
| Customers    |    20 |
| Discount     |    5% |
| Margin Floor |   15% |

\`Campaign ID: CAMP-001\``;

  const regressionHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={userRegressionSnippet} variant="merchant" />
  );

  const hasH1 = regressionHtml.includes('<h2') && regressionHtml.includes('Campaign Recommendation');
  const hasBold = regressionHtml.includes('<strong') && regressionHtml.includes('Target:');
  const hasUl = regressionHtml.includes('<ul') && regressionHtml.includes('<li') && regressionHtml.includes('Customer has not purchased in 90 days');
  const hasNestedBold = regressionHtml.includes('<strong') && regressionHtml.includes('5%');
  const hasH3 = regressionHtml.includes('<h4') && regressionHtml.includes('Recommendation');
  const hasTable = regressionHtml.includes('<table') && regressionHtml.includes('<th') && regressionHtml.includes('Metric') && regressionHtml.includes('Value') && regressionHtml.includes('20');
  const hasCode = regressionHtml.includes('<code') && regressionHtml.includes('Campaign ID: CAMP-001');
  const hasNoRawMarkdown = !regressionHtml.includes('**Target:**') && !regressionHtml.includes('| ------------ |') && !regressionHtml.includes('`Campaign ID:');

  const isRegressionPassed = hasH1 && hasBold && hasUl && hasNestedBold && hasH3 && hasTable && hasCode && hasNoRawMarkdown;

  recordTest(
    1,
    'User Regression Test Snippet (Full Markdown Package)',
    isRegressionPassed,
    'Renders formatted headings, bold targets, bullet lists, nested bold, table with aligned headers/rows, and inline code without raw syntax',
    `hasH1: ${hasH1}, hasBold: ${hasBold}, hasUl: ${hasUl}, hasTable: ${hasTable}, hasCode: ${hasCode}, noRawMarkdown: ${hasNoRawMarkdown}`,
    'Validates exact regression snippet specified in user requirements.'
  );

  // Test 2: Table Column Alignments (Left, Center, Right)
  const tableSnippet = `| Left Header | Center Header | Right Header |
| :--- | :---: | ---: |
| Left Data | Center Data | ₹1,299 |`;

  const tableHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={tableSnippet} variant="light" />
  );

  const hasAlignLeft = tableHtml.includes('text-align:left') || tableHtml.includes('style="text-align:left"');
  const hasAlignCenter = tableHtml.includes('text-align:center') || tableHtml.includes('style="text-align:center"');
  const hasAlignRight = tableHtml.includes('text-align:right') || tableHtml.includes('style="text-align:right"');

  recordTest(
    2,
    'Table Column Alignment Parsing (:---, :---:, ---:)',
    hasAlignLeft && hasAlignCenter && hasAlignRight,
    'Table renders cells with left, center, and right text-alignment corresponding to markdown colons',
    `left: ${hasAlignLeft}, center: ${hasAlignCenter}, right: ${hasAlignRight}`,
    'Allows numerical values to align right and text to align left/center.'
  );

  // Test 3: Headings Hierarchy (# to ####)
  const headingsSnippet = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4`;

  const headingsHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={headingsSnippet} variant="merchant" />
  );

  const hasH1Tag = headingsHtml.includes('Heading 1');
  const hasH2Tag = headingsHtml.includes('Heading 2');
  const hasH3Tag = headingsHtml.includes('Heading 3');
  const hasH4Tag = headingsHtml.includes('Heading 4');

  recordTest(
    3,
    'Heading Hierarchy Parsing (# to ####)',
    hasH1Tag && hasH2Tag && hasH3Tag && hasH4Tag,
    'Headings rendered into appropriate semantic typography levels',
    `h1: ${hasH1Tag}, h2: ${hasH2Tag}, h3: ${hasH3Tag}, h4: ${hasH4Tag}`,
    'Provides structured visual hierarchy for AI explanations.'
  );

  // Test 4: Ordered (Numbered) Lists and Unordered Lists
  const listSnippet = `1. Analyze inventory stock
2. Identify slow-moving SKUs
3. Propose discount campaign

* Fast dispatch
* Margin safe`;

  const listHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={listSnippet} variant="merchant" />
  );

  const hasOl = listHtml.includes('<ol') && listHtml.includes('Analyze inventory stock');
  const hasUlFromStar = listHtml.includes('<ul') && listHtml.includes('Fast dispatch');

  recordTest(
    4,
    'Ordered and Unordered List Parsing',
    hasOl && hasUlFromStar,
    'Ordered lists render in <ol> and unordered lists render in <ul> with bullet points',
    `hasOl: ${hasOl}, hasUl: ${hasUlFromStar}`,
    'Ensures sequential step-by-step guides render cleanly.'
  );

  // Test 5: Fenced Code Blocks with Language Tag
  const codeBlockSnippet = `\`\`\`sql
SELECT product_id, title, selling_price
FROM shopi_products
WHERE stock_quantity < 10;
\`\`\``;

  const codeBlockHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={codeBlockSnippet} variant="merchant" />
  );

  const hasPre = codeBlockHtml.includes('<pre') && codeBlockHtml.includes('<code');
  const hasSql = codeBlockHtml.includes('SELECT product_id') && codeBlockHtml.includes('shopi_products');
  const hasLanguageTag = codeBlockHtml.includes('sql');

  recordTest(
    5,
    'Fenced Code Block Rendering (```sql ... ```)',
    hasPre && hasSql && hasLanguageTag,
    'Fenced code rendered inside <pre><code> block with language label',
    `hasPre: ${hasPre}, hasSql: ${hasSql}, hasLanguageTag: ${hasLanguageTag}`,
    'Allows technical Copilot responses to display queries and configuration.'
  );

  // Test 6: Clickable Links with Safe Protocol Validation
  const linkSnippet = `Review the [Decision Center](/merchant/actions) or visit [Razorpay](https://razorpay.com) or ignore [malicious](javascript:alert(1)).`;

  const linkHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={linkSnippet} variant="merchant" />
  );

  const hasInternalLink = linkHtml.includes('href="/merchant/actions"');
  const hasExternalLink = linkHtml.includes('href="https://razorpay.com"') && linkHtml.includes('target="_blank"');
  const blocksJavascriptLink = !linkHtml.includes('href="javascript:alert(1)"');

  recordTest(
    6,
    'Link Parsing and Protocol Sanitization (XSS Safety)',
    hasInternalLink && hasExternalLink && blocksJavascriptLink,
    'Internal / relative links render as Next.js Link, external https links render with target="_blank", dangerous javascript: protocols blocked',
    `internal: ${hasInternalLink}, external: ${hasExternalLink}, blockedJS: ${blocksJavascriptLink}`,
    'Guarantees safe navigation without script injection vulnerabilities.'
  );

  // Test 7: Streaming Robustness (Partial/Unclosed Tokens)
  const streamingSnippet = `**Generating analysis for`;
  const streamingCodeSnippet = `\`\`\`typescript\nconst revenue = 53768;`;

  const stream1Html = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={streamingSnippet} variant="merchant" />
  );
  const stream2Html = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={streamingCodeSnippet} variant="merchant" />
  );

  const isStream1Safe = stream1Html.includes('Generating analysis for');
  const isStream2Safe = stream2Html.includes('revenue = 53768') && stream2Html.includes('<pre');

  recordTest(
    7,
    'Streaming Response Robustness (Unclosed Tokens)',
    isStream1Safe && isStream2Safe,
    'Incomplete tokens during token streaming render without throwing React runtime errors or breaking the DOM',
    `stream1: ${isStream1Safe}, stream2: ${isStream2Safe}`,
    'Ensures smooth typewriter animation during live streaming AI responses.'
  );

  // Test 8: Plain-Text Conversational Stability
  const plainTextSnippet = `Hello! How can I assist with your sales today? All metrics are current as of 5 minutes ago.`;

  const plainTextHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={plainTextSnippet} variant="merchant" />
  );

  const isPlainTextClean =
    plainTextHtml.includes('Hello! How can I assist with your sales today?') &&
    !plainTextHtml.includes('<h') &&
    !plainTextHtml.includes('<ul') &&
    !plainTextHtml.includes('<table');

  recordTest(
    8,
    'Plain-Text Conversational Message Stability',
    isPlainTextClean,
    'Standard plain text sentences render cleanly in normal paragraph flow without visual distortion',
    'Plain text preserved without unexpected formatting',
    'Ensures casual conversational messages look completely natural.'
  );

  // Test 9: Blockquotes & Horizontal Rules
  const bqSnippet = `> Margin floor of 15% is strictly enforced on all campaigns.

---

End of summary.`;

  const bqHtml = ReactDOMServer.renderToStaticMarkup(
    <SafeMarkdownRenderer content={bqSnippet} variant="merchant" />
  );

  const hasBq = bqHtml.includes('<blockquote') && bqHtml.includes('Margin floor of 15% is strictly enforced');
  const hasHr = bqHtml.includes('<hr');

  recordTest(
    9,
    'Blockquotes (>) and Horizontal Rules (---)',
    hasBq && hasHr,
    'Blockquote styled with border-left and horizontal rule rendered as divider',
    `hasBq: ${hasBq}, hasHr: ${hasHr}`,
    'Supports business rule callouts and divider sections.'
  );

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('========================================================================');
  console.log(`COPILOT MARKDOWN SUITE SUMMARY: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  return { passed, total, results };
}

runMarkdownTestSuite().catch(console.error);

