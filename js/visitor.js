function Visitor() {
}

Visitor.prototype.visit = function(node) {
    if (node instanceof SvgRenderer.ParallelFrame) {
        return this.visit_parallel(node);
    }

    if (node instanceof SvgRenderer.SerialFrame) {
        return this.visit_serial(node);
    }

    if (node instanceof SvgRenderer.TerminalState) {
        return this.visit_terminal(node);
    }

    if (node instanceof SvgRenderer.MasterFrame) {
        return this.visit_master(node);
    }
}

Visitor.prototype.visit_master = function(node) {
    //master frame is ignored
    return this.visit(node.child());
}

Visitor.prototype.visit_parallel = function(node) {
    var children = [];
    for (var i = 0; i < node.childNodes.length; i++) {
        child = node.childNodes[i];
        children.push(this.visit(child));
    }
    return {type: 'ParallelFrame', children: children};
}

Visitor.prototype.visit_serial = function(node) {
    var children = [];
    children.push(this.visit(node.leftChild()));
    var next_child = node.rightChild();
    if (next_child !== undefined) {
        children = children.concat(this.visit(next_child).children);
    }

    return {type: 'SerialFrame', children: children};
}


Visitor.prototype.visit_terminal = function(node) {
    return {type: 'TerminalState', moduleName: node.moduleName, name: node.stateName, args: node.getArgs()};
}

