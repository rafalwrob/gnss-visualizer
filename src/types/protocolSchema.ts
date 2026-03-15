export type FieldType = 'u8' | 'u16' | 'u32' | 'i8' | 'i16' | 'i32' | 'f32' | 'f64';
export type ChecksumType = 'none' | 'fletcher8' | 'crc16' | 'xor' | 'sum8';
export type OutputType = 'positionFix' | 'measurements' | 'observations';
export type Endian = 'LE' | 'BE';

export interface FieldDef {
  /** Nazwa pola w danych wyjściowych (lub alias jeśli zdefiniowano `as`) */
  name: string;
  type: FieldType;
  /** Offset w bajtach względem początku payloadu (lub elementu w `repeat`) */
  offset: number;
  /** Mnożnik wartości (np. 1e-7 dla lat/lon w [1e-7 deg] → [deg]) */
  scale?: number;
  /** Mapowanie wartości całkowitej na string (np. { 0:'none', 1:'2d', 2:'3d' }) */
  map?: Record<number, string>;
  /** Nadpisuje nazwę pola wyjściowego (np. name='pr', as='pseudorange') */
  as?: string;
}

export interface RepeatConfig {
  /** Offset licznika powtórzeń w nagłówku payloadu */
  countOffset: number;
  countSize: 1 | 2;
  /** Rozmiar jednego elementu w bajtach */
  itemSize: number;
}

export interface MessageDef {
  output: OutputType;
  fields: FieldDef[];
  /** Dla measurements/observations: opis powtarzającego się elementu */
  repeat?: RepeatConfig;
}

export interface FrameConfig {
  /** Bajty synchronizacji (1–4), np. [0xAA, 0x55] */
  sync: number[];
  /** Domyślny byte order dla pól wielobajtowych */
  endian: Endian;
  /** Całkowity rozmiar nagłówka (offset początku payloadu) */
  headerSize: number;
  /** Identyfikator wiadomości w nagłówku */
  msgId: { offset: number; size: 1 | 2 | 4 };
  /** Długość payloadu w nagłówku */
  payloadLen: { offset: number; size: 1 | 2 | 4 };
  /** Typ sumy kontrolnej za payloadem */
  checksum: ChecksumType;
  /** Opcjonalne bajty końcowe za checksumem, np. [0x0D, 0x0A] */
  trailer?: number[];
}

export interface ProtocolSchema {
  name: string;
  description: string;
  /** Marker rozpoznawany przez pluginLoader */
  $schema: true;
  frame: FrameConfig;
  /** Klucz: numeryczny ID wiadomości */
  messages: Record<number, MessageDef>;
}
