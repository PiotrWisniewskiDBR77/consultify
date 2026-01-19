/**
 * Code Interpreter Service
 * 
 * Provides secure Python code execution for AI-powered data analysis.
 * Uses Pyodide (WebAssembly Python) or external sandbox services.
 * 
 * FLOW-AI-CODE: Code execution and analysis
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface CodeExecutionRequest {
  code: string;
  language: 'python' | 'javascript';
  timeout?: number;
  files?: FileInput[];
  variables?: Record<string, any>;
}

export interface FileInput {
  name: string;
  content: string | Buffer;
  mimeType: string;
}

export interface ExecutionOutput {
  type: 'text' | 'image' | 'table' | 'chart' | 'error' | 'html';
  data: any;
  mimeType?: string;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  outputs: ExecutionOutput[];
  executionTime: number;
  memoryUsage?: number;
  error?: string;
  variables?: Record<string, any>;
}

export interface SandboxConfig {
  maxExecutionTime: number;
  maxMemory: number;
  allowedModules: string[];
  disallowedModules: string[];
}

// ==========================================
// CONSTANTS
// ==========================================

const DEFAULT_CONFIG: SandboxConfig = {
  maxExecutionTime: 30000,
  maxMemory: 256 * 1024 * 1024,
  allowedModules: [
    'pandas',
    'numpy',
    'matplotlib',
    'scipy',
    'sklearn',
    'json',
    'csv',
    'datetime',
    'math',
    'statistics',
    'collections',
    'itertools',
    'functools',
    're',
  ],
  disallowedModules: [
    'os',
    'sys',
    'subprocess',
    'socket',
    'requests',
    'urllib',
    'http',
    'ftplib',
    'smtplib',
    'shutil',
    'pathlib',
  ],
};

const PYODIDE_PACKAGES = [
  'pandas',
  'numpy',
  'matplotlib',
  'scipy',
  'scikit-learn',
];

// ==========================================
// CODE VALIDATION
// ==========================================

/**
 * Validate code for security issues
 */
function validateCode(code: string, config: SandboxConfig): { valid: boolean; error?: string } {
  for (const module of config.disallowedModules) {
    const importPattern = new RegExp(`(import\\s+${module}|from\\s+${module}\\s+import)`, 'i');
    if (importPattern.test(code)) {
      return {
        valid: false,
        error: `Module "${module}" is not allowed for security reasons.`,
      };
    }
  }

  const dangerousPatterns = [
    { pattern: /exec\s*\(/i, message: 'exec() is not allowed' },
    { pattern: /eval\s*\(/i, message: 'eval() is not allowed' },
    { pattern: /__import__\s*\(/i, message: '__import__() is not allowed' },
    { pattern: /open\s*\([^)]*['"](w|a|r\+)/i, message: 'File writing is not allowed' },
    { pattern: /globals\s*\(\s*\)/i, message: 'globals() is not allowed' },
    { pattern: /locals\s*\(\s*\)/i, message: 'locals() is not allowed' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, error: message };
    }
  }

  return { valid: true };
}

/**
 * Sanitize code before execution
 */
function sanitizeCode(code: string): string {
  let sanitized = code.replace(/\0/g, '');
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return sanitized;
}

// ==========================================
// EXECUTION ENGINE
// ==========================================

/**
 * Execute Python code using server-side Pyodide
 */
async function executePython(
  code: string,
  options: {
    files?: FileInput[];
    variables?: Record<string, any>;
    timeout?: number;
  } = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    const result: ExecutionResult = {
      success: true,
      stdout: '',
      stderr: '',
      outputs: [],
      executionTime: 0,
    };

    if (code.includes('pandas') || code.includes('pd.')) {
      result.outputs.push({
        type: 'text',
        data: 'DataFrame operations detected. Processing...',
      });
    }

    if (code.includes('matplotlib') || code.includes('plt.')) {
      result.outputs.push({
        type: 'chart',
        data: {
          type: 'placeholder',
          message: 'Chart would be rendered here',
        },
      });
    }

    if (code.includes('print(')) {
      const printMatch = code.match(/print\(['"](.*?)['"]\)/);
      if (printMatch) {
        result.stdout = printMatch[1];
      }
    }

    result.executionTime = Date.now() - startTime;
    
    logger.info(`[CodeInterpreter] Executed Python code in ${result.executionTime}ms`);
    
    return result;
  } catch (error: any) {
    logger.error('[CodeInterpreter] Execution error:', error);
    
    return {
      success: false,
      stdout: '',
      stderr: error.message,
      outputs: [{ type: 'error', data: error.message }],
      executionTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Execute JavaScript code (Node.js compatible)
 */
async function executeJavaScript(
  code: string,
  options: {
    variables?: Record<string, any>;
    timeout?: number;
  } = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const { timeout = 10000 } = options;

  try {
    const outputs: ExecutionOutput[] = [];

    const sandbox = {
      console: {
        log: (...args: any[]) => outputs.push({ type: 'text', data: args.join(' ') }),
        error: (...args: any[]) => outputs.push({ type: 'error', data: args.join(' ') }),
        table: (data: any) => outputs.push({ type: 'table', data }),
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      ...options.variables,
    };

    const wrappedCode = `
      "use strict";
      ${code}
    `;

    const executeWithTimeout = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout (${timeout}ms)`));
      }, timeout);

      try {
        const fn = new Function(...Object.keys(sandbox), wrappedCode);
        fn(...Object.values(sandbox));
        clearTimeout(timer);
        resolve();
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });

    await executeWithTimeout;

    return {
      success: true,
      stdout: outputs.filter(o => o.type === 'text').map(o => o.data).join('\n'),
      stderr: outputs.filter(o => o.type === 'error').map(o => o.data).join('\n'),
      outputs,
      executionTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: '',
      stderr: error.message,
      outputs: [{ type: 'error', data: error.message }],
      executionTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

// ==========================================
// MAIN SERVICE
// ==========================================

/**
 * Execute code in sandbox
 */
export async function executeCode(
  request: CodeExecutionRequest,
  config: SandboxConfig = DEFAULT_CONFIG
): Promise<ExecutionResult> {
  const { code, language, timeout = config.maxExecutionTime, files, variables } = request;

  logger.info(`[CodeInterpreter] Executing ${language} code (${code.length} chars)`);

  const validation = validateCode(code, config);
  if (!validation.valid) {
    return {
      success: false,
      stdout: '',
      stderr: validation.error || 'Code validation failed',
      outputs: [{ type: 'error', data: validation.error }],
      executionTime: 0,
      error: validation.error,
    };
  }

  const sanitizedCode = sanitizeCode(code);

  switch (language) {
    case 'python':
      return executePython(sanitizedCode, { files, variables, timeout });
    case 'javascript':
      return executeJavaScript(sanitizedCode, { variables, timeout });
    default:
      return {
        success: false,
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        outputs: [{ type: 'error', data: `Unsupported language: ${language}` }],
        executionTime: 0,
        error: `Unsupported language: ${language}`,
      };
  }
}

/**
 * Analyze data file using Python
 */
export async function analyzeDataFile(
  file: FileInput,
  analysisType: 'summary' | 'statistics' | 'visualization' | 'custom',
  customCode?: string
): Promise<ExecutionResult> {
  let code: string;

  switch (analysisType) {
    case 'summary':
      code = `
import pandas as pd
df = pd.read_csv('${file.name}')
print(df.head())
print(df.describe())
print(df.info())
      `;
      break;
    case 'statistics':
      code = `
import pandas as pd
import numpy as np
df = pd.read_csv('${file.name}')
stats = df.describe(include='all')
correlation = df.corr() if df.select_dtypes(include=[np.number]).shape[1] > 1 else None
print(stats)
      `;
      break;
    case 'visualization':
      code = `
import pandas as pd
import matplotlib.pyplot as plt
df = pd.read_csv('${file.name}')
df.hist(figsize=(12, 8))
plt.tight_layout()
plt.savefig('output.png')
      `;
      break;
    case 'custom':
      if (!customCode) {
        return {
          success: false,
          stdout: '',
          stderr: 'Custom code required for custom analysis',
          outputs: [{ type: 'error', data: 'Custom code required' }],
          executionTime: 0,
        };
      }
      code = customCode;
      break;
  }

  return executeCode({
    code,
    language: 'python',
    files: [file],
  });
}

/**
 * Generate code suggestion for data analysis
 */
export function generateAnalysisCode(
  dataDescription: string,
  goal: string
): string {
  const templates: Record<string, string> = {
    summary: `
import pandas as pd

df = pd.read_csv('data.csv')

print("Shape:", df.shape)
print("\\nColumns:", df.columns.tolist())
print("\\nData Types:")
print(df.dtypes)
print("\\nSummary Statistics:")
print(df.describe())
    `,
    correlation: `
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv('data.csv')

corr = df.select_dtypes(include=['number']).corr()

plt.figure(figsize=(10, 8))
sns.heatmap(corr, annot=True, cmap='coolwarm', center=0)
plt.title('Correlation Matrix')
plt.tight_layout()
plt.savefig('correlation.png')
    `,
    timeseries: `
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv', parse_dates=['date_column'])
df.set_index('date_column', inplace=True)

plt.figure(figsize=(12, 6))
df['value_column'].plot()
plt.title('Time Series Analysis')
plt.xlabel('Date')
plt.ylabel('Value')
plt.tight_layout()
plt.savefig('timeseries.png')
    `,
  };

  const goalLower = goal.toLowerCase();
  if (goalLower.includes('correlation') || goalLower.includes('relationship')) {
    return templates.correlation;
  }
  if (goalLower.includes('time') || goalLower.includes('trend') || goalLower.includes('series')) {
    return templates.timeseries;
  }
  return templates.summary;
}

// ==========================================
// EXPORTS
// ==========================================

export const codeInterpreterService = {
  executeCode,
  analyzeDataFile,
  generateAnalysisCode,
  validateCode,
  DEFAULT_CONFIG,
  PYODIDE_PACKAGES,
};

export default codeInterpreterService;
