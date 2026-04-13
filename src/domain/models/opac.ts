export type OpacIdentifier = {
  system: 'isbn' | 'issn' | 'oclc' | 'local';
  value: string;
};

export type OpacBriefRecord = {
  id: string;
  title: string;
  authors: string[];
  detailUrl?: string;
  publishedYear?: number;
  format?: string;
  identifiers?: OpacIdentifier[];
  coverUrl?: string;
};

export type OpacHolding = {
  id: string;
  location: string;
  callNumber?: string;
  status: 'available' | 'checked_out' | 'on_hold' | 'in_transit' | 'unknown';
  dueDate?: string;
};

export type OpacRecord = OpacBriefRecord & {
  description?: string;
  subjects?: string[];
  language?: string;
  publisher?: string;
  holdings?: OpacHolding[];
};

export type OpacAvailability = {
  recordId: string;
  availableCount: number;
  totalCount: number;
  holdsCount?: number;
};

export type OpacSearchQuery = {
  q: string;
  author?: string;
  title?: string;
  subject?: string;
  format?: 'book' | 'ebook' | 'audio' | 'video' | 'other';
  page?: number;
  pageSize?: number;
};

export type OpacSearchResult = {
  total: number;
  page: number;
  pageSize: number;
  records: OpacBriefRecord[];
};
