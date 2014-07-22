import json

x = '{"type":"SerialFrame","children":[{"type":"ParallelFrame","children":[{"type":"SerialFrame","children":[{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":"24"},{"name":"Time","value":""},{"name":"another","value":""}]},{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]},{"type":"SerialFrame","children":[{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]}]},{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]}'


def visit(node):
    return globals()['visit_'+node['type']](node)

def visit_SerialFrame(node):
    ans = "("
    for child in node['children']:
        ans += visit(child)+"+"
    return ans[:-1] +")"


def visit_ParallelFrame(node):
    ans = "("
    for child in node['children']:
        ans += visit(child)+"&"
    return ans[:-1] +")" 

def visit_TerminalState(node):
    ans = node['moduleName']+"."+node['name']+"("
    for agr in node['args']:
        ans += agr['value'] + ","
    return ans[:-1] +")"

if __name__ == '__main__':
    root_node = json.loads(x)
    print(visit(root_node))

(((LED1.state1(24,,)+LED1.state1(,,))&(LED1.state1(,,)))+LED1.state1(,,))