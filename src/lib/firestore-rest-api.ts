const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDPT2fOwzfW8u89x9qDfCzsyhazWohOjhk';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cms-011';
const DATABASE_ID = 'cms1';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

export function jsToFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = jsToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function firestoreValueToJs(valObj: any): any {
  if (!valObj) return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
  if ('nullValue' in valObj) return null;
  if ('arrayValue' in valObj) {
    const arr = valObj.arrayValue?.values || [];
    return arr.map(firestoreValueToJs);
  }
  if ('mapValue' in valObj) {
    const fields = valObj.mapValue?.fields || {};
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = firestoreValueToJs(v);
    }
    return res;
  }
  return null;
}

export function firestoreDocToJs(doc: any): any {
  if (!doc) return null;
  const id = doc.name ? doc.name.split('/').pop() : undefined;
  const res: Record<string, any> = { id };
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      res[k] = firestoreValueToJs(v);
    }
  }
  return res;
}

export async function getDocument(collectionName: string, documentId: string) {
  const url = `${BASE_URL}/${collectionName}/${documentId}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Firestore REST getDocument failed: ${res.statusText}`);
  }
  const data = await res.json();
  return firestoreDocToJs(data);
}

export async function setDocument(collectionName: string, documentId: string, data: Record<string, any>) {
  const url = `${BASE_URL}/${collectionName}/${documentId}?key=${API_KEY}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = jsToFirestoreValue(v);
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST setDocument failed: ${res.status} ${errText}`);
  }
  return firestoreDocToJs(await res.json());
}

export async function queryDocuments(collectionName: string, field: string, op: 'EQUAL' | 'GREATER_THAN', value: any) {
  const url = `${BASE_URL}:runQuery?key=${API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionName }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: op,
          value: jsToFirestoreValue(value)
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST queryDocuments failed: ${res.status} ${errText}`);
  }

  const results: any[] = await res.json();
  const docs: any[] = [];
  for (const item of results) {
    if (item.document) {
      docs.push(firestoreDocToJs(item.document));
    }
  }
  return docs;
}
