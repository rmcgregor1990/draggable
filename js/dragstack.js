function DragStack() {
	this.elementList = []
}

DragStack.prototype.addElement = function(element)
{
	element.data("dsParent", null);
	element.data("dsChild", null);

}