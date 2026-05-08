/** Identical OT logic to the backend — shared between client and server. */

export type Op =
  | { t: 'r'; n: number }
  | { t: 'i'; s: string }
  | { t: 'd'; n: number };

export class TextOperation {
  ops: Op[] = [];
  baseLength = 0;
  targetLength = 0;

  retain(n: number): this {
    if (n <= 0) return this;
    this.baseLength += n;
    this.targetLength += n;
    const last = this.ops[this.ops.length - 1];
    if (last?.t === 'r') { last.n += n; } else { this.ops.push({ t: 'r', n }); }
    return this;
  }

  insert(s: string): this {
    if (!s) return this;
    this.targetLength += s.length;
    const last = this.ops[this.ops.length - 1];
    if (last?.t === 'i') { last.s += s; } else { this.ops.push({ t: 'i', s }); }
    return this;
  }

  delete(n: number): this {
    if (n <= 0) return this;
    this.baseLength += n;
    const last = this.ops[this.ops.length - 1];
    if (last?.t === 'd') { last.n += n; } else { this.ops.push({ t: 'd', n }); }
    return this;
  }

  apply(doc: string): string {
    if (doc.length !== this.baseLength) {
      throw new Error(`apply: doc.length (${doc.length}) !== baseLength (${this.baseLength})`);
    }
    let result = '';
    let i = 0;
    for (const op of this.ops) {
      if (op.t === 'r') { result += doc.slice(i, i + op.n); i += op.n; }
      else if (op.t === 'i') { result += op.s; }
      else { i += op.n; }
    }
    return result;
  }

  static compose(op1: TextOperation, op2: TextOperation): TextOperation {
    if (op1.targetLength !== op2.baseLength) throw new Error('compose: length mismatch');
    const result = new TextOperation();
    const a = op1.ops.slice(), b = op2.ops.slice();
    let ai = 0, bi = 0, ar = 0, br = 0;
    const lenOf = (op: Op) => op.t === 'i' ? op.s.length : op.n;

    while (ai < a.length || bi < b.length) {
      const oa = a[ai], ob = b[bi];
      if (oa?.t === 'd') { result.delete(oa.n - ar); ai++; ar = 0; continue; }
      if (ob?.t === 'i') { result.insert(ob.s.slice(br)); bi++; br = 0; continue; }
      if (!oa || !ob) break;

      const ra = lenOf(oa) - ar, rb = lenOf(ob) - br, take = Math.min(ra, rb);
      if (oa.t === 'r' && ob.t === 'r') result.retain(take);
      else if (oa.t === 'i' && ob.t === 'r') result.insert(oa.s.slice(ar, ar + take));
      else if (oa.t === 'i' && ob.t === 'd') { /* cancel */ }
      else if (oa.t === 'r' && ob.t === 'd') result.delete(take);

      ar += take; br += take;
      if (ar === lenOf(oa)) { ai++; ar = 0; }
      if (br === lenOf(ob)) { bi++; br = 0; }
    }
    return result;
  }

  static transform(op1: TextOperation, op2: TextOperation): [TextOperation, TextOperation] {
    if (op1.baseLength !== op2.baseLength) throw new Error('transform: baseLength mismatch');
    const op1p = new TextOperation(), op2p = new TextOperation();
    const a = op1.ops.slice(), b = op2.ops.slice();
    let ai = 0, bi = 0, ar = 0, br = 0;
    const lenOf = (op: Op) => op.t === 'i' ? op.s.length : op.n;

    while (ai < a.length || bi < b.length) {
      const oa = a[ai], ob = b[bi];
      if (oa?.t === 'i') {
        const rem = oa.s.length - ar;
        op1p.insert(oa.s.slice(ar)); op2p.retain(rem);
        ai++; ar = 0; continue;
      }
      if (ob?.t === 'i') {
        const rem = ob.s.length - br;
        op1p.retain(rem); op2p.insert(ob.s.slice(br));
        bi++; br = 0; continue;
      }
      if (!oa || !ob) break;

      const ra = lenOf(oa) - ar, rb = lenOf(ob) - br, take = Math.min(ra, rb);
      if (oa.t === 'r' && ob.t === 'r') { op1p.retain(take); op2p.retain(take); }
      else if (oa.t === 'd' && ob.t === 'r') { op1p.delete(take); }
      else if (oa.t === 'r' && ob.t === 'd') { op2p.delete(take); }
      // both delete → both primes do nothing

      ar += take; br += take;
      if (ar === lenOf(oa)) { ai++; ar = 0; }
      if (br === lenOf(ob)) { bi++; br = 0; }
    }
    return [op1p, op2p];
  }

  toJSON() {
    return { ops: this.ops, baseLength: this.baseLength, targetLength: this.targetLength };
  }

  static fromJSON(data: { ops: Op[]; baseLength: number; targetLength: number }): TextOperation {
    const op = new TextOperation();
    op.ops = data.ops;
    op.baseLength = data.baseLength;
    op.targetLength = data.targetLength;
    return op;
  }

  /** Convert CodeMirror 6 ChangeSet changes into a TextOperation */
  static fromCMChanges(
    changes: Array<{ from: number; to: number; insert: string }>,
    docLength: number
  ): TextOperation {
    const op = new TextOperation();
    let pos = 0;
    for (const ch of changes) {
      if (ch.from > pos) op.retain(ch.from - pos);
      if (ch.to > ch.from) op.delete(ch.to - ch.from);
      if (ch.insert) op.insert(ch.insert);
      pos = ch.to;
    }
    if (pos < docLength) op.retain(docLength - pos);
    return op;
  }

  /** Transform a cursor position through an operation */
  static transformCursor(cursor: number, op: TextOperation): number {
    let newCursor = 0, docPos = 0;
    for (const o of op.ops) {
      if (o.t === 'r') {
        if (docPos + o.n >= cursor) { newCursor += cursor - docPos; break; }
        newCursor += o.n; docPos += o.n;
      } else if (o.t === 'i') {
        newCursor += o.s.length;
      } else {
        if (docPos + o.n >= cursor) break;
        docPos += o.n;
      }
    }
    return newCursor;
  }
}
