export function flattenObject(obj: object) {
  return flattenObjectInit(obj, '', {});
}

function flattenObjectInit(obj: any, key: string, res: any) {
  if (isObject(obj)) {
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const newKey = key ? `${key}.${k}` : k;
        flattenObjectInit(obj[k], newKey, res);
      }
    }
  } else {
    if (key) {
      res[key] = obj;
    } else {
      res = obj;
    }
  }
  return res;
}

export function replaceStringPlaceholders(str: string, view: any) {
  if (typeof str === 'string') {
    const soloPlaceholder = str.match(/^\s*{{\s*([\w.]+)\s*}}\s*$/);
    // If the string has only one placeholder, return the value directly
    if (soloPlaceholder) {
      const flattenedKey = soloPlaceholder[1];
      const value = getValueFromFlattenedKey(view, flattenedKey);
      // If the value exists, replace it, if not, return the original string
      if (value !== undefined) {
        return value;
      } else {
        console.log(`replaceStringPlaceholders: Value not found for key: ${flattenedKey}`);
        return str;
      }
    } else {
      const regex = /\{\{\s*([\w.]+)\s*\}\}/g;
      return str.replace(regex, (_, flattenedKey) => {
        const value = getValueFromFlattenedKey(view, flattenedKey);
        // If the value exists, replace it, if not, return the original string
        if (isObject(value)) {
          return JSON.stringify(value);
        } else if (value !== undefined) {
          return String(value);
        } else {
          console.log(`replaceStringPlaceholders: Value not found for key: ${flattenedKey}`);
          return '{{ ' + flattenedKey + ' }}';
        }
      });
    }
  } else {
    console.log('replaceStringPlaceholders: Object is not a string');
    return str;
  }
}

export function replacePlaceholders(obj: any, view: any) {
  // If the object is a string, return the string with replaced placeholders
  if (typeof obj === 'string') {
    return replaceStringPlaceholders(obj, view);
  } else if (isObject(obj)) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // For every key in the object, enter the recursion
        obj[key] = replacePlaceholders(obj[key], view);
      }
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      // For every element in the array, enter the recursion
      obj[i] = replacePlaceholders(obj[i], view);
    }
  }
  // In case of a number, boolean, undefined, or null, return the value directly
  return obj;
}

/**
 * Get a value from a flattened key.
 * If the key does not exist, return undefined.
 *
 * @param {Object} obj - The object to get the value from.
 * @param {string} key - The flattened key.
 * @returns {any} - The value.
 *
 * @example
 * const obj = {
 * a: {
 *  b: {
 *  c: 1
 * }
 * }
 * };
 *
 * getValueFromFlattenedKey(obj, 'a.b.c');
 * // Returns 1
 *
 */
export function getValueFromFlattenedKey(obj: any, key: string) {
  const keys = key.split('.');
  let value = obj;
  for (const k of keys) {
    if (value[k] === undefined) {
      return undefined;
    }
    value = value[k];
  }
  return value;
}

export function existsFlattenedKey(obj: any, key: string) {
  const keys = key.split('.');
  let value = obj;
  for (const k of keys) {
    if (value[k] === undefined) {
      return false;
    }
    value = value[k];
  }
  return true;
}

/**
 * Check if two processes are compatible.
 * At least one process must be in common.
 *
 * @param {string|string[]} p1 - The first process or array of processes.
 * @param {string|string[]} p2 - The second process or array of processes.
 * @returns {boolean} - True if the processes are compatible, false otherwise.
 */
export function isProcessCompatible(p1: string | string[], p2: string | string[]) {
  if (!p1 || !p2) {
    return false;
  }
  p1 = Array.isArray(p1) ? p1 : [p1];
  p2 = Array.isArray(p2) ? p2 : [p2];
  if (p1.length >= p2.length) {
    const s = new Set(p1);
    return p2.some((v) => s.has(v));
  } else {
    const s = new Set(p2);
    return p1.some((v) => s.has(v));
  }
}

export function isObject(obj: any) {
  return typeof obj === 'object' && obj != null && !Array.isArray(obj);
}

export function applyExtensionFlattenedKey(obj: any, key: string, value: any) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      console.log(`Ignoring extension: ${key}. Key does not exist.`);
      return;
    }
    current = current[keys[i]];
  }

  const lastKey = keys.at(-1);

  if (!lastKey || !Object.prototype.hasOwnProperty.call(current, lastKey)) {
    console.log(`Ignoring extension: ${key}. Property does not exist or is inherited and cannot be modified.`);
    return;
  }

  // Case: Property is a string
  if (typeof current[lastKey] === 'string') {
    if (typeof value === 'string') {
      current[lastKey] += ' ' + value;
    } else if (Array.isArray(value)) {
      current[lastKey] += ', ' + value.join(', ');
    } else {
      console.log(`Ignoring extension: ${key}. Unexpected value data type.`);
    }
  }

  // Case: Property is an array
  else if (Array.isArray(current[lastKey])) {
    if (typeof value === 'string') {
      current[lastKey].push(value);
    } else if (Array.isArray(value)) {
      current[lastKey] = current[lastKey].concat(value);
    } else {
      console.log(`Ignoring extension: ${key}. Unexpected value data type.`);
    }
  }

  // For other cases, we replace the value. TODO: Add more cases.
  else {
    current[lastKey] = value;
  }
}

export function applyOverrideFlattenedKey(obj: any, key: string, value: any) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      console.log(`Ignoring override: ${key}. Key does not exist.`);
      return;
    }
    current = current[keys[i]];
  }

  const lastKey = keys.at(-1);

  if (!lastKey || !Object.prototype.hasOwnProperty.call(current, lastKey)) {
    console.log(`Ignoring override: ${key}. Property does not exist or is inherited and cannot be modified.`);
    return;
  }

  current[lastKey] = value;
}
