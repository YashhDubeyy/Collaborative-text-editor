import { TextOperation } from './TextOperation';

/**
 * OTServer — Server-side OT state machine.
 *
 * Tracks the authoritative document state and revision history.
 * When a client sends an op based on an older revision, we transform
 * it against all subsequent ops before applying it.
 */
export class OTServer {
  private document: string;
  private revision: number;
  // history[i] is the op that moved the document from revision i → i+1
  private history: TextOperation[];

  constructor(document = '', revision = 0, history: TextOperation[] = []) {
    this.document = document;
    this.revision = revision;
    this.history = history;
  }

  getDocument() { return this.document; }
  getRevision() { return this.revision; }

  /**
   * Receive a client operation based on `clientRevision`.
   * Transforms it against all operations the client hasn't seen yet,
   * applies it to the document, and returns the transformed op.
   */
  receiveOp(clientRevision: number, op: TextOperation): TextOperation {
    if (clientRevision < 0 || clientRevision > this.revision) {
      throw new Error(
        `Invalid revision: client sent ${clientRevision}, server is at ${this.revision}`
      );
    }

    // Transform op against all history ops since the client's revision
    let transformedOp = op;
    for (let i = clientRevision; i < this.revision; i++) {
      // Transform: [serverOp', transformedOp'] = transform(serverOp, transformedOp)
      // We only need transformedOp' (the client op adjusted for the server op)
      [, transformedOp] = TextOperation.transform(this.history[i], transformedOp);
    }

    // Apply the fully transformed op to the current document
    this.document = transformedOp.apply(this.document);
    this.history.push(transformedOp);
    this.revision++;

    return transformedOp;
  }

  /**
   * Returns the ops a client needs to catch up from `fromRevision` to current.
   * Used when a client reconnects with a stale revision.
   */
  getOpsSince(fromRevision: number): TextOperation[] {
    if (fromRevision < 0 || fromRevision > this.revision) {
      throw new Error(`getOpsSince: invalid revision ${fromRevision}`);
    }
    return this.history.slice(fromRevision);
  }

  /** Serialize state for persistence */
  toSnapshot() {
    return {
      document: this.document,
      revision: this.revision,
    };
  }

  static fromSnapshot(snapshot: { document: string; revision: number }): OTServer {
    return new OTServer(snapshot.document, snapshot.revision, []);
  }
}

/** In-memory store: docId → OTServer instance */
export const docServers = new Map<string, OTServer>();

export function getOrCreateDocServer(docId: string, document = '', revision = 0): OTServer {
  if (!docServers.has(docId)) {
    docServers.set(docId, new OTServer(document, revision));
  }
  return docServers.get(docId)!;
}
