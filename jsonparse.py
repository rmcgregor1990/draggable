import json

x = '{"type":"SerialFrame","children":[{"type":"ParallelFrame","children":[{"type":"SerialFrame","children":[{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":"24"},{"name":"Time","value":""},{"name":"another","value":""}]},{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]},{"type":"SerialFrame","children":[{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]}]},{"type":"TerminalState","moduleName":"LED1","name":"state1","args":[{"name":"Current","value":""},{"name":"Time","value":""},{"name":"another","value":""}]}]}'


class Visitor():
    def visit(self, node):
        return self.__getattribute__('visit_'+node['type'])(node)   

    def visit_SerialFrame(self, node):
        ans = "("
        for child in node['children']:
            ans += self.visit(child)+"+"
        return ans[:-1] +")"


    def visit_ParallelFrame(self, node):
        ans = "("
        for child in node['children']:
            ans += self.visit(child)+"&"
        return ans[:-1] +")" 

    def visit_TerminalState(self, node):
        ans = node['moduleName']+"."+node['name']+"("
        for agr in node['args']:
            ans += agr['value'] + ","
        return ans[:-1] +")"

if __name__ == '__main__':
    root_node = json.loads(x)
    vistor = Visitor();
    print(vistor.visit(root_node))
