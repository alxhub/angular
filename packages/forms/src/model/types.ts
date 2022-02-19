
/**
 * OptionalKeys returns the union of all optional keys in the object.
 *
 * Angular uses this type internally to support Typed Forms; do not use it directly.
 */
 export type OptionalKeys<T> = {
    [K in keyof T] -?: undefined extends T[K] ? K : never
  }[keyof T];
  
  /**
   * RequiredKeys returns the union of all required keys in the object.
   *
   * Angular uses this type internally to support Typed Forms; do not use it directly.
   */
  export type RequiredKeys<T> = {
    [K in keyof T] -?: undefined extends T[K] ? never : K
  }[keyof T];
  
  /**
   * IndexSignatureOf<T> returns an object having the index signature from T. If no index signature is
   * present in T, this will return an empty object.
   */
  export type IndexSignatureOf<T> = {
    [K in keyof T as string extends K ? K : number extends K ? K : never]: T[K]
  };
  
  /**
   * KnownKeys returns all named (non-index) keys in T.
   */
  export type KnownKeys<T> = {
    [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
  };
  
  /**
   * HasIndexSignature returns T if string has an index signature, else never.
   */
  export type HasIndexSignature<T> = IndexSignatureOf<T> extends Record<any, never>? never : T;
  
  /**
   * KeyIsRemovable determines whether V is a removable property in the object T.
   * If V is a required named property in T, then V is never removable.
   * If V is an optional named property in T, then V is always removable.
   * If V is not a named property but an index signature is present in T, then V is removable.
   *
   * @publicApi
   */
  export type KeyIsRemovable<T, V extends string> = HasIndexSignature<T> extends never ?
      OptionalKeys<T>:
      V&(V extends RequiredKeys<KnownKeys<T>>? never : {});
