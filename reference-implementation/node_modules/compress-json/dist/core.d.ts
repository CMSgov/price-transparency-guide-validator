import { Key, Value } from './memory';
export declare type Values = Value[];
export declare type Compressed = [Values, Key];
export declare function compress(o: object): Compressed;
export declare function decode(values: Values, key: Key): any;
export declare function decompress(c: Compressed): any;
