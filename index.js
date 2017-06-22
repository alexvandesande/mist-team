const Web3 = require("web3");
// TODO: FIgure out how this stuff works
// let web3 = (typeof web3 !== 'undefined') ? new Web3(web3.currentProvider) : new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/NEefAs8cNxYfiJsYCQjc"));


const mistTeamSpec = require("./mistteam.json");
const priceSpec = require("./priceOracle.json");
// const blockies = require("./libs/blockies.min.js");
const mistTeam = (typeof web3 !== 'undefined') ? web3.eth.contract(mistTeamSpec.abi).at(mistTeamSpec.address) : null;
const priceOracle = (typeof web3 !== 'undefined') ? web3.eth.contract(priceSpec.abi).at(priceSpec.address) : null;
const Q = require("bluebird");
const _ = require("underscore");

Q.promisifyAll(mistTeam);
Q.promisifyAll(priceOracle);
Q.promisifyAll(web3.eth);

class Proposal extends React.Component {
  constructor(props) {
    super(props);
    this.state = { showButtons: true};
  }

  render() {
    const {proposal, approver} = this.props;

    return <div className="proposal">
    <h1> {proposal.title} <strong>€{proposal.amount}</strong>  </h1>
    <h3> {proposal.date.toISOString().slice(0,10)}  </h3>

    Requested By: <strong>{proposal.requestedBy}</strong> <br/>
    Send to: <a href={'https://etherscan.io/address/'+proposal.recipient}>{proposal.recipient}</a> <br/><br/>
    {Number(proposal.documentation) == 0 ? <em> No documentation provided </em> : <a href={'bzz://'+proposal.documentation} title={'download from bzz://'+proposal.documentation}> Download documentation from swarm </a>}<br/>
    <br/>
    {(approver > 0 && proposal.status == 'pending') ? this.state.showButtons ? <div className="center"> 
      <button onClick={() => ApproveProposal(proposal.proposalNumber, approver, true, this)} className='dapp-block-button approve'>Approve</button> 
      <button onClick={() => ApproveProposal(proposal.proposalNumber, approver, false, this)} className='dapp-block-button reject'>Reject</button>
      </div> : <div className="center"> <img src="imgs/loading.gif" height="60"/> </div> : null}
    {proposal.status == 'executed' ? <i className="simple-icon icon-check"></i> : null }
    {proposal.status == 'rejected' ? <i className="simple-icon icon-ban"></i> : null }

  </div>;
  }
}

const ApproveProposal = (proposalNumber, approver, approve, parent) => {    
    parent.setState({showButtons: false});
    setTimeout(function() {
      parent.setState({showButtons: true});
    }, 120000);

    mistTeam.approveRequestAsync(proposalNumber, approve, '', {
      from: approver
    })
  };

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      teamAddress: mistTeamSpec.address,
      price: 0,
      lastPriceCheck: 0,
      owner: "N/A",
      ownerIcon: '',
      numProposals: 0,
      balance:0,
      displayBalance:0,
      proposals: [],
      show: 'pending',
      requester: '',
      approver: '',
      account:'',
      canApprove: false,
      canRequest: false
    };

    this.container = {
        height: "100%",
        display: "flex",
        flexDirection: "column"
    }
  }

  updateData() {
    console.log('updateData...');
    priceOracle.priceAsync().then((price) => {
        this.setState({price: Math.round(price.toFixed())/100});
        web3.eth.getBalance(mistTeamSpec.address, (err, res) => {
            this.setState({balance: Math.floor(web3.fromWei(res.toFixed(), 'ether') * price.toFixed())/100});
        }) 
    });

    priceOracle.lastUpdateAsync().then((lastUpdate) => {
      this.setState({lastPriceCheck: (new Date() - new Date(lastUpdate.toFixed()*1000))/(60*60*1000)});
    });

    mistTeam.ownerAsync().then((owner) => {
      this.setState({owner: owner});
      // blockies.createAsync().then(data => {
      //   console.log('blockies', data);
      // })
      // this.setState({ownerIcon: blockies.create({ seed: owner ,size: 8,scale: 16}).toDataURL()});
      
    });

    const teamNames = ['', 'A.V.', 'A.V. (approver)', 'V.M.', 'E.F.', 'J.W.', 'F.V.'];

    mistTeam.numProposalsAsync().then((numProposals) => {
      const proposalRequests = _.range(0,numProposals)
        .map((p, i) => mistTeam.proposalsAsync(p).then(p => ( {
          proposalNumber: i,
          title: p[4],
          requestedBy: teamNames[p[1].toFixed()],
          date: new Date(p[3].toFixed() * 1000),
          recipient: p[0],
          documentation: p[5].replace('0x',''),
          amount: parseFloat(Math.round(p[2].toFixed()) / 100).toFixed(2) ,
          status: p[6] ? 'executed' : p[9].toFixed() < p[8].toFixed() ? 'rejected' : 'pending'
        })));
      return Q.all(proposalRequests)
        .then(proposals => this.setState({proposals: proposals}))
    });

    const trace = a => (console.log(a), a);

    // mistTeam.numProposalsAsync()
    //   .then((numProposals) => {
    //     console.log('numProposals', numProposals.toFixed(), mistTeam.proposalsAsync(0), mistTeam.proposalsAsync)
    //     const proposalRequests = _.range(0,numProposals.toFixed())
    //       .map((p, i) => mistTeam.proposalsAsync(p)
    //         .then(p => {
    //           console.log('p:', p, i);
    //         }));
    // });

    web3.eth.getAccountsAsync()
      .then(accs => { 
        this.setState({account: accs[0]}); 
        return accs; 
      })
      .then(accs => Q.all(accs.map(acc => mistTeam.memberIdAsync(acc))))
      .then(accIds => Q.all(accIds.map(ids => mistTeam.membersAsync(ids.toFixed()))))
      .then(members => Q.all(_.each(members, member => {
        if(member[1]) { 
          this.setState({canApprove: true}); 
          this.setState({approver: member[0]}); 
        };
        if(member[2]) { 
          this.setState({canRequest: true});           
          this.setState({requester: member[0]}); 
        };
      })))

  }

  componentDidMount() {
    if (typeof web3 === "undefined") return;

    this.updateData();
    const _this = this;

    web3.eth.filter('latest').watch(function(e, res){
      _this.updateData();
    });

    setInterval(() => {
      if (Math.abs(_this.state.balance - _this.state.displayBalance) >= 0.01) {
        let newBalance = _this.state.displayBalance + (_this.state.balance - _this.state.displayBalance)/10;
        _this.setState({displayBalance: newBalance}); 
      }
    }, 50)
  }
  
  render() {
    if (typeof web3 === "undefined") return <div className="dapp-container"><h1> <br/><br/>💾👴🏽<br/> Browser doesn't support web3 </h1></div>
    return  <div style={this.container} className="dapp-container">
    <header className='dapp-header'>
      <h1>Mist Team Budget </h1> 

    </header>

    <div className='dapp-flex-content'>
        
        <aside className='dapp-aside'>
        <h3> Current balance </h3>
        <h1>€{ parseFloat(Math.round(this.state.displayBalance * 100) / 100).toFixed(2)}</h1>
        <ul>
          <li><button onClick={() => this.setState({show: "all"})} disabled={this.state.show == 'all'}> All </button></li>
          <li><button onClick={() => this.setState({show: "pending"})} disabled={this.state.show == 'pending'}> pending </button></li>
          <li><button onClick={() => this.setState({show: "executed"})} disabled={this.state.show == 'executed'}> Executed </button></li>
          <li><button onClick={() => this.setState({show: "rejected"})} disabled={this.state.show == 'rejected'}> Rejected</button></li>
        </ul>

        <div>
          Team Address: {this.state.teamAddress}. <br/>
          This team is currently managed by: {this.state.owner}. <br/>
          {this.state.canRequest ? this.state.canApprove ? <em> You can approve and request. </em> : <em> You can request. </em> : <em> You are not a member. </em> } 
          <h3 title={Math.floor(this.state.lastPriceCheck) + ' hours ago'}> Latest price: €{this.state.price}  
          {this.state.lastPriceCheck > 1 ? <button onClick={() => {
            // console.log(this.state.account,Math.round(web3.toWei(0.25 / this.state.price, 'ether')) , Math.floor(1000*0.25 / this.state.price) );
            priceOracle.updateAsync({ 
              from: this.state.account, 
              value: Math.floor(web3.toWei(0.25 / this.state.price, 'ether')) 
            })}}> <i className="icon-refresh"></i> </button> : null }</h3><br/>
        </div>

        </aside>

        <main className='dapp-content'>
        {this.state.proposals
          .filter(p => this.state.show === "all" || this.state.show === p.status)
          .reverse()
          .map( p => { return <Proposal proposal={p} approver={this.state.canApprove ? this.state.approver : null } /> })}
        {this.state.proposals.filter(p => this.state.show === "all" || this.state.show === p.status).length == 0 ? <h1> No proposals to show </h1> : null }
        </main>

    </div>

    </div>;
  }
}

ReactDOM.render(
  React.createElement(App),
  document.getElementById('main'));
