export class EditorHistory {
  constructor({limit = 50, bytes = 8 * 1024 ** 2} = {}) { this.limit=limit; this.bytes=bytes; this.undoStack=[]; this.redoStack=[]; }
  breakGroup() { this.group = null; }
  record(before, after, {group, label='Editar JSON', now=Date.now()} = {}) {
    if (before === after) return;
    this.redoStack=[];
    const previous=this.undoStack.at(-1);
    if (group && this.group === group && previous && now-this.time < 1000) previous.after=after;
    else this.undoStack.push({before,after,label});
    this.group=group; this.time=now; this.boundary=false;
    const size = () => this.undoStack.reduce((sum,entry)=>sum+2*(entry.before.length+entry.after.length),0);
    while (this.undoStack.length>this.limit || size()>this.bytes) { this.undoStack.shift(); this.boundary=true; }
  }
  replay(direction, text) {
    this.breakGroup();
    const source=direction==='undo'?this.undoStack:this.redoStack, destination=direction==='undo'?this.redoStack:this.undoStack;
    const entry=source.at(-1); if (!entry) return text;
    if (text !== (direction==='undo'?entry.after:entry.before)) throw new Error('Histórico divergente; operação cancelada.');
    source.pop(); destination.push(entry); return direction==='undo'?entry.before:entry.after;
  }
}
