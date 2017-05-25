const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/sE0I5J1gO2jugs9LndHR"));
const mistTeamSpec = require("./mistteam.json");
const mistTeam = web3.eth.contract(mistTeamSpec.abi).at(mistTeamSpec.address);

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      owner: "N/A"
    };
  }

  componentDidMount() {
    mistTeam.owner((err, owner) => {
      if (!err) {
        this.setState({owner: owner});
      }
    });
  }

  render() {
    return <div>
      <h3>Mist Team DApp!</h3>
      <p>Contract owner: {this.state.owner}</p>
    </div>;
  }
}

ReactDOM.render(
  React.createElement(App),
  document.getElementById('main'));
