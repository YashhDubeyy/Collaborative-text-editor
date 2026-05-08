/**
 * TextOperation — The core of Operational Transformation.
 *
 * An operation is a sequence of three primitive components:
 *   retain(n)  — skip over n characters (they remain unchanged)
 *   insert(s)  — insert string s at current position
 *   delete(n)  — delete n characters at current position
 *
 * Key invariants:
 *   sum of retain(n) + delete(n) === baseLength   (chars consumed from source)
 *   sum of retain(n) + insert(s) === targetLength  (chars produced in result)
 */

export type Op =
  | { t: 'r'; n: number }   // retain
  | { t: 'i'; s: string }   // insert
  | { t: 'd'; n: number };  // delete

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

  /** Apply this operation to a document string. */
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

  /** Create an operation that reverts this one. */
  invert(doc: string): TextOperation {
    const inv = new TextOperation();
    let i = 0;
    for (const op of this.ops) {
      if (op.t === 'r') { inv.retain(op.n); i += op.n; }
      else if (op.t === 'i') { inv.delete(op.s.length); }
      else { inv.insert(doc.slice(i, i + op.n)); i += op.n; }
    }
    return inv;
  }

  /**
   * compose(op1, op2): op1 transforms A→B, op2 transforms B→C.
   * Returns op3 that directly transforms A→C.
   */
  static compose(op1: TextOperation, op2: TextOperation): TextOperation {
    if (op1.targetLength !== op2.baseLength) {
      throw new Error('compose: op1.targetLength !== op2.baseLength');
    }
    const result = new TextOperation();

    // Iterator helpers
    const a = op1.ops.slice(), b = op2.ops.slice();
    let ai = 0, bi = 0;
    let ar = 0, br = 0; // remaining chars in current op

    const peekA = () => a[ai];
    const peekB = () => b[bi];
    const advA = () => { ai++; ar = 0; };
    const advB = () => { bi++; br = 0; };

    // Remaining length of current op (chars it "sees" in the intermediate doc)
    const lenA = (op: Op) => op.t === 'i' ? op.s.length : op.n;
    const lenB = (op: Op) => op.t === 'i' ? op.s.length : op.n;

    while (ai < a.length || bi < b.length) {
      const oa = peekA(), ob = peekB();

      // op1 delete → result delete (op2 never sees these chars)
      if (oa?.t === 'd') {
        const rem = oa.n - ar;
        result.delete(rem);
        advA();
        continue;
      }
      // op2 insert → result insert (op1 never produced these chars)
      if (ob?.t === 'i') {
        const rem = ob.s.length - br;
        result.insert(ob.s.slice(br));
        advB();
        continue;
      }

      if (!oa || !ob) break;

      const ra = lenA(oa) - ar;
      const rb = lenB(ob) - br;
      const take = Math.min(ra, rb);

      if (oa.t === 'r' && ob.t === 'r') {
        result.retain(take);
      } else if (oa.t === 'i' && ob.t === 'r') {
        result.insert(oa.s.slice(ar, ar + take));
      } else if (oa.t === 'i' && ob.t === 'd') {
        // insert then delete → nothing
      } else if (oa.t === 'r' && ob.t === 'd') {
        result.delete(take);
      }

      ar += take; br += take;
      if (ar === lenA(oa)) advA(); if (br === lenB(ob)) advB();
    }

    return result;
  }

  /**
   * transform(op1, op2): Both ops are based on the same document state.
   * Returns [op1', op2'] such that:
   *   apply(apply(doc, op1), op2') === apply(apply(doc, op2), op1')
   *
   * This is the heart of OT conflict resolution.
   */
  static transform(op1: TextOperation, op2: TextOperation): [TextOperation, TextOperation] {
    if (op1.baseLength !== op2.baseLength) {
      throw new Error(`transform: baseLength mismatch (${op1.baseLength} vs ${op2.baseLength})`);
    }
    const op1p = new TextOperation();
    const op2p = new TextOperation();

    const a = op1.ops.slice(), b = op2.ops.slice();
    let ai = 0, bi = 0;
    let ar = 0, br = 0;

    const lenA = (op: Op) => op.t === 'i' ? op.s.length : op.n;
    const lenB = (op: Op) => op.t === 'i' ? op.s.length : op.n;

    while (ai < a.length || bi < b.length) {
      const oa = a[ai], ob = b[bi];

      // op1 inserts: op1' carries the insert, op2' retains over it
      if (oa?.t === 'i') {
        const rem = oa.s.length - ar;
        op1p.insert(oa.s.slice(ar));
        op2p.retain(rem);
        ai++; ar = 0;
        continue;
      }
      // op2 inserts: op2' carries the insert, op1' retains over it
      if (ob?.t === 'i') {
        const rem = ob.s.length - br;
        op1p.retain(rem);
        op2p.insert(ob.s.slice(br));
        bi++; br = 0;
        continue;
      }

      if (!oa || !ob) break;

      const ra = lenA(oa) - ar;
      const rb = lenB(ob) - br;
      const take = Math.min(ra, rb);

      if (oa.t === 'r' && ob.t === 'r') {
        op1p.retain(take);
        op2p.retain(take);
      } else if (oa.t === 'd' && ob.t === 'r') {
        op1p.delete(take);
        // op2p: nothing (chars deleted by op1)
      } else if (oa.t === 'r' && ob.t === 'd') {
        // op1p: nothing (chars deleted by op2)
        op2p.delete(take);
      } else if (oa.t === 'd' && ob.t === 'd') {
        // Both delete the same chars → both primes do nothing
      }

      ar += take; br += take;
      if (ar === lenA(oa)) { ai++; ar = 0; }
      if (br === lenB(ob)) { bi++; br = 0; }
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

  /** Build a TextOperation from a CodeMirror-style change list */
  static fromCMChanges(
    changes: Array<{ from: number; to: number; insert: string }>,
    docLength: number
  ): TextOperation {
    const op = new TextOperation();
    let pos = 0;
    for (const change of changes) {
      if (change.from > pos) op.retain(change.from - pos);
      if (change.to > change.from) op.delete(change.to - change.from);
      if (change.insert) op.insert(change.insert);
      pos = change.to;
    }
    if (pos < docLength) op.retain(docLength - pos);
    return op;
  }
}
