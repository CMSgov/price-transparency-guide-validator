declare type Parent = any[] | object;
export declare type Key = string;
export declare type Value = string | null;
/**
 * potential implementation of store are:
 * - raw object ({})
 * - array
 * - Map
 * - localStorage
 * - lmdb
 * - leveldb (sync mode)
 * */
export interface Store {
    add(value: Value): void;
    forEach(cb: (value: Value) => void | 'break'): void;
    toArray(): Value[];
}
/**
 * potential implementation of cache are:
 * - raw object ({})
 * - array
 * - Map
 * - localStorage
 * - lmdb
 * - leveldb (sync mode)
 * */
export interface Cache {
    hasValue(key: Key): boolean;
    hasSchema(key: Key): boolean;
    getValue(key: Key): Value | undefined;
    getSchema(key: Key): Value | undefined;
    setValue(key: Key, value: Value): void;
    setSchema(key: Key, value: Value): void;
    forEachValue(cb: (key: Key, value: any) => void | 'break'): void;
    forEachSchema(cb: (key: Key, value: any) => void | 'break'): void;
}
export interface Memory {
    store: Store;
    cache: Cache;
    keyCount: number;
}
export declare function memToValues(mem: Memory): Value[];
export declare function makeInMemoryStore(): Store;
export declare function makeInMemoryCache(): Cache;
export declare function makeInMemoryMemory(): Memory;
export declare function addValue(mem: Memory, o: any, parent: Parent | undefined): Key;
export {};
