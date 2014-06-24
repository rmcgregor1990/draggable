function SvgRenderer(svg_element) {
    this.canvas = SVG(svg_element);
    this.elements = [];
    this.init();
    this.snapDistance = 30;
}

SvgRenderer.prototype = {
    elements : [],

    parentThis: undefined,

    init: function() {
        parentThis = this;
    },

    addElement: function(pos, colour) {
        if (colour === undefined) colour = '#0000ff';
        var group = this.canvas.group()
        var rect = this.canvas.rect(100, 50).attr({fill: colour});
        var fobj = this.canvas.foreignObject(100,30).attr({id:'fobj'});
        fobj.appendChild("input", {id: 'input', size:10});
        group.add(rect);
        group.add(fobj);
        group.move(pos[0], pos[1]);
        group.draggable({}, rect);
        group.dragmove = this._elementOnDrag;
        group.dragend = this._elementOnStopDrag;
        group.dragstart = this._elementOnStartDrag;

        group.parentGroup = null;
        group.childGroup = null;

        this.elements.push(group);
    },

    _groupSnap: function(child) {
        for (var i = parentThis.elements.length - 1; i >= 0; i--) {
            var element = parentThis.elements[i];
            if (element !== child && (element.childGroup == null || element.childGroup === child)) {
                var box = element.bbox();
                var dist = Math.sqrt(Math.pow(child.x()-box.x, 2) + Math.pow(child.y()-box.y2, 2));
                if (dist < parentThis.snapDistance) {
                    var child_set = parentThis._getStackSet(child);
                    var dx = box.x-child.x();
                    var dy = box.y2-child.y();
                    child_set.dmove(dx, dy);
                    element.childGroup = child;
                    //element.add(child);
                }
                else {
                    element.childGroup = null;
                }
            }
        };
    },

    _getStackSet: function(parent) {
        var tempset = parentThis.canvas.set();
        tempset.add(parent);
        var next_child = parent.childGroup;
        while(next_child !== null) {
            tempset.add(next_child);
            next_child = next_child.childGroup;
        }

        return tempset;
    },

    _elementOnDrag: function(delta, event) {
        if (parentThis.lastDelta == undefined) parentThis.lastDelta = {x:0, y:0};

        parentThis._groupSnap(this);
        var next_child = this.childGroup;
        while(next_child !== null) {
            next_child.dmove(delta.x - parentThis.lastDelta.x, delta.y - parentThis.lastDelta.y);
            next_child = next_child.childGroup;
        }
        parentThis.lastDelta = delta;
    },

    _elementOnStartDrag: function(delta, event) {


    },

    _elementOnStopDrag: function(delta, event) {
        parentThis.lastDelta = undefined;
    }
}
