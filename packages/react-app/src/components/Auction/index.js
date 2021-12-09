import React, { useEffect } from "react";
import { useContractReader, useContractLoader, useContractExistsAtAddress } from "eth-hooks";
import tryToDisplay from "./utils";
import moment from "moment";
import { Input, Button } from "antd";
import { toast } from "react-toastify";
import { Transactor } from "../../helpers";
import axios from "axios";
import externalContracts from "./external_contracts";

function abbrAddress(address) {
  return address.slice(0, 4) + "..." + address.slice(address.length - 4);
}
const noContractDisplay = (
  <div>
    Loading...{" "}
    <div style={{ padding: 32 }}>
      You need to run{" "}
      <span
        className="highlight"
        style={{ marginLeft: 4, /* backgroundColor: "#f1f1f1", */ padding: 4, borderRadius: 4, fontWeight: "bolder" }}
      >
        yarn run chain
      </span>{" "}
      and{" "}
      <span
        className="highlight"
        style={{ marginLeft: 4, /* backgroundColor: "#f1f1f1", */ padding: 4, borderRadius: 4, fontWeight: "bolder" }}
      >
        yarn run deploy
      </span>{" "}
      to see your contract here.
    </div>
    <div style={{ padding: 32 }}>
      <span style={{ marginRight: 4 }} role="img" aria-label="warning">
        ☢️
      </span>
      Warning: You might need to run
      <span
        className="highlight"
        style={{ marginLeft: 4, /* backgroundColor: "#f1f1f1", */ padding: 4, borderRadius: 4, fontWeight: "bolder" }}
      >
        yarn run deploy
      </span>{" "}
      <i>again</i> after the frontend comes up!
    </div>
  </div>
);

const { utils, BigNumber } = require("ethers");

export default function Auction({
  customContract,
  account,
  gasPrice,
  signer,
  provider,
  name,
  show,
  price,
  mainnetProvider,
  kovanProvider,
  address,
  blockExplorer,
  chainId,
  contractConfig,
}) {
  // gladgo contract for now
  const cDAIxAddress = "0x3ED99f859D586e043304ba80d8fAe201D4876D57";

  const contracts = useContractLoader(provider, contractConfig, chainId);
  const contracts_kovan = useContractLoader(kovanProvider, {
    externalContracts: externalContracts,
  });
  // console.log("contracts: ", contracts);
  // console.log("contracts_kovan: ", contracts_kovan);

  const glad_address = "0x8B231C8323E448152605B35BEb8c2498731C5D30";
  const gladBalanceCDAI = useContractReader(contracts_kovan, "CErc20Delegator", "balanceOf", [glad_address]);
  // if (gladBalanceCDAI) {
  //   console.log("gladBalanceCDAI", gladBalanceCDAI / 1e8);
  // }
  const gladBalanceCDAIx = useContractReader(contracts_kovan, "UUPSProxy", "balanceOf", [glad_address]);
  // if (gladBalanceCDAIx) {
  //   console.log("gladBalanceCDAIx", utils.parseEther(String(gladBalanceCDAIx)));
  // }
  var userBalance = useContractReader(contracts_kovan, "UUPSProxy", "balanceOf", [
    "0xfa083dfd09f3a7380f6df6e25dd277e2780de41d",
  ]);
  // if (userBalance) {
  //   console.log("userBalance", utils.parseEther(String(userBalance)));
  // }
  var gladFlow = useContractReader(contracts_kovan, "UUPSProxy", "getNetFlow", [cDAIxAddress, glad_address]);
  // if (gladFlow) {
  //   console.log("gladFlow", utils.parseEther(String(gladFlow)));
  // }
  var userFlow = useContractReader(contracts_kovan, "UUPSProxy", "getFlow", [
    cDAIxAddress,
    glad_address,
    "0xfa083dfd09f3a7380f6df6e25dd277e2780de41d",
  ]);
  // if (userFlow) {
  //   console.log("userFlow", userFlow);
  //   console.log("userFlow.flowRate", utils.parseEther(String(userFlow.flowRate)));
  // }

  const tx = Transactor(provider, gasPrice);
  // If you want to make 🔐 write transactions to your contracts, use the userSigner:

  const [currentGladId, setCurrentGladId] = React.useState(null);
  const [gladInformation, setGladInformation] = React.useState({
    gladId: 0,
    startTime: null,
    endTime: null,
    amount: BigNumber.from("0000000000"),
    bidder: "0x0000000000000000000000000000000000000000",
    settled: true,
    minBid: 0.1,
  });
  const [minBid, setMinBid] = React.useState(0.1);
  const [duration, setDuration] = React.useState();
  const [ended, setEnded] = React.useState(false);
  const [bidLoading, setBidLoading] = React.useState(false);
  const [txValue, setTxValue] = React.useState();
  const [returnValue, setReturnValue] = React.useState();
  const [winner, setWinner] = React.useState();
  const [bidDisabled, setBidDisabled] = React.useState(false);
  const [settleDisabled, setSettleDisabled] = React.useState(false);

  const [bidHeading, setBidHeading] = React.useState("Current Bid");
  const [timerHeading, setTimerHeading] = React.useState("Ends In");
  const [bids, setBids] = React.useState([]);
  const [allBids, setAllBids] = React.useState([]);

  // keep track of a variable from the contract in the local React state:
  let contract;
  if (!customContract) {
    contract = contracts ? contracts[name] : "";
  } else {
    contract = customContract;
  }
  var address_contract = contract ? contract.address : "";
  const contractIsDeployed = useContractExistsAtAddress(provider, address_contract);
  const currentAuction = useContractReader(contracts, "GladsAuctionHouse", "auction");

  async function bid() {
    try {
      setBidLoading(true);
      const overrides = {};
      if (txValue) {
        overrides.value = utils.parseEther(txValue);
      }
      if (gasPrice) {
        overrides.gasPrice = gasPrice;
      }
      // Uncomment this if you want to skip the gas estimation for each transaction
      // overrides.gasLimit = hexlify(1200000);

      // console.log("Running with extras",extras)
      const returned = await tx(contract.connect(signer).createBid(currentGladId, overrides));
      console.log("returned", returned);
      let result = tryToDisplay(returned);

      console.log("SETTING RESULT:", result);
      setReturnValue(result);

      var bid = {
        bid: txValue,
        bidder: address,
        date: Date.now(),
      };
      setBids([...bids, bid]);
      setGladInformation({ ...gladInformation, amount: overrides.value });
      getAuction(gladInformation.gladId, { ...gladInformation, amount: overrides.value });

      setTxValue();
      setBidLoading(false);
      toast(
        <>
          <span className="font-bold">{"Bid Received!"}!</span>
        </>,
        {
          position: "bottom-left",
          autoClose: 1500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          draggablePercent: 20,
          progress: undefined,
        },
      );
    } catch (error) {
      setBidLoading(false);
      console.log("ERROR bid:", error);
      toast.error(
        <>
          <span className="font-bold">{"Error bidding. Please, try again later"}!</span>{" "}
        </>,
        {
          position: "bottom-left",
          autoClose: 1500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          draggablePercent: 20,
          progress: undefined,
        },
      );
    }
  }

  async function settleAuction() {
    try {
      setSettleDisabled(true);
      console.log("SETTLE AUCTION", contract);
      const overrides = {};
      if (txValue) {
        overrides.value = txValue; // ethers.utils.parseEther()
      }
      if (gasPrice) {
        overrides.gasPrice = gasPrice;
      }
      const returned = await tx(contract.connect(signer).settleCurrentAndCreateNewAuction(overrides));
      let result = tryToDisplay(returned);
      console.log("settle result-> ", result);
      toast(
        <>
          <span className="font-bold">{"Settled"}!</span>
        </>,
        {
          position: "bottom-left",
          autoClose: 1500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          draggablePercent: 20,
          progress: undefined,
        },
      );
      getAuction();
      // getFlows();
      setSettleDisabled(false);
    } catch (error) {
      setSettleDisabled(false);
      console.log("ERROR settleAuction:", error);
      toast.error(
        <>
          <span className="font-bold">{"Error settling. Please, try again later"}!</span>
        </>,
        {
          position: "bottom-left",
          autoClose: 1500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          draggablePercent: 20,
          progress: undefined,
        },
      );
    }
  }

  var timer;
  function countdown(a) {
    try {
      const endTime = a.endTime;
      const currentTime = Date.now() / 1000;
      const diffTime = endTime - currentTime;
      let duration_temp = moment.duration(diffTime * 1000, "milliseconds");
      const interval = 1000;

      timer = setInterval(async () => {
        console.log("timer", "countdown on");
        if (!duration) {
          console.log("duration", "duration is null");
          clearInterval(timer);
        }
        duration_temp = moment.duration(duration_temp - interval, "milliseconds");

        if (duration_temp.asSeconds() < 0) {
          // time's up
          var a = currentAuction;
          clearInterval(timer);
          setWinner(abbrAddress(a.bidder));
          getAuction();
        } else {
          setWinner();
          setDuration(duration_temp);
        }
      }, interval);
    } catch (error) {
      console.log("ERROR countdown:", error);
    }
  }

  function nextGlad() {
    var currentID = parseInt(currentGladId);
    setCurrentGladId(currentID + 1);
    return false;
  }
  function prevGlad() {
    var currentID = parseInt(currentGladId);
    setCurrentGladId(currentID - 1);

    return false;
  }

  async function getAuction(thisGlad, gladInformation_updated = gladInformation) {
    try {
      console.log("thisGlad", thisGlad);
      if (!BigNumber.isBigNumber(gladInformation_updated.amount)) return;
      var a;
      if (typeof thisGlad === "undefined") {
        a = gladInformation_updated;
      } else {
        a = {
          gladId: thisGlad,
          startTime: null,
          endTime: null,
          amount: BigNumber.from("0000000000"),
          bidder: "0x0000000000000000000000000000000000000000",
          settled: true,
          minBid: 0.1,
        };
      }
      console.log("getAuction", a);
      setGladInformation(a);
      var minBid_temp = parseFloat(utils.formatUnits(a.amount, "ether")) * 1.1;
      if (minBid_temp == 0) {
        // reserve price
        minBid_temp = 0.1;
      }
      setMinBid(minBid_temp.toFixed(2));

      const endTime = a.endTime;
      console.log("endTime", endTime);
      if (endTime) {
        const currentTime = Date.now() / 1000;
        const diffTime = endTime - currentTime;
        if (diffTime < 0) {
          setEnded(true);
        }
        var duration_temp = moment.duration(diffTime * 1000, "milliseconds");
        setDuration(duration_temp);
        var timerHeading = "Ends in";
        var bidHeading = "Current Bid";
        if (duration_temp.asSeconds() < 0) {
          timerHeading = "Winner";
          bidHeading = "Winning Bid";
        }
        setTimerHeading(timerHeading);
        setBidHeading(bidHeading);

        var gladIdTopic_temp = utils.parseUnits(String(a.gladId)).toHexString();

        var gladIdTopic = utils.hexZeroPad(gladIdTopic_temp, 32 - gladIdTopic_temp.length);

        // https://api.covalenthq.com/v1/42/events/topics/0x1159164c56f277e6fc99c11731bd380e0347deb969b75523398734c252706ea3/?starting-block=27539184&ending-block=latest&sender-address=0x5FbDB2315678afecb367f032d93F642f64180aa3&match=%7B%22raw_log_topics.1%22%3A%220x00000000000000000000000000000000000000000000000000000000%22%7D&sort=%7B%22block_signed_at%22%3A%22-1%22%7D&key=ckey_ac7c55f53e19476b85f0a1099af
        // const covEventsUrl =
        //   "https://api.covalenthq.com/v1/42/events/topics/0x1159164c56f277e6fc99c11731bd380e0347deb969b75523398734c252706ea3/?starting-block=27539184&ending-block=latest&sender-address=" +
        //   contract.address +
        //   "&match=%7B%22raw_log_topics.1%22%3A%22" +
        //   gladIdTopic +
        //   "%22%7D&sort=%7B%22block_signed_at%22%3A%22-1%22%7D&key=ckey_c0e60b280d004b3b87e97eda19c";

        if (duration_temp.asSeconds() > 0) {
          console.log("⏱ start coundown");
          countdown(a);
        } else {
          console.log("🥰 Time for auction is out");
          var a = currentAuction;
          setWinner(abbrAddress(a.bidder));
          // getAuction();
        }

        const contract_address = "0x93c08fe426882B0A69F9D88b9c5Df17Ef8F4F92E";
        const covEventsUrl =
          "https://api.covalenthq.com/v1/42/events/topics/0x1159164c56f277e6fc99c11731bd380e0347deb969b75523398734c252706ea3/?starting-block=27690000&ending-block=latest&sender-address=" +
          contract_address +
          "&match=%7B%22raw_log_topics.1%22%3A%22" +
          gladIdTopic +
          "%22%7D&sort=%7B%22block_signed_at%22%3A%22-1%22%7D&key=" +
          process.env.COVALENT_KEY;

        const covEvents = await axios.get(covEventsUrl, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-type": "Application/json",
          },
        });
        // if (covEvents.data.items.length === 0) return;

        // const response = await fetch(covEventsUrl);
        // var covEvents = await response.json();
        var logs = covEvents.data.data.items;
        console.log("logs", covEvents.data, logs);
        logs.forEach((log, index) => {
          console.log(log);
          var event = web3.eth.abi.decodeParameters(["address", "uint256", "bool"], log.raw_log_data);
          console.log(event);
          var amt = parseFloat(utils.formatEther(event[1]));
          if (index == 0) {
            a.amount = event[1];
            a.bidder = event[0];
            if (!a.endTime) {
              a.endTime = moment(log.block_signed_at).format("X");
            }
            if (!a.startTime) {
              a.startTime = moment(log.block_signed_at).format("X") - 60 * 60;
            }
          }
          var bid = {
            bidder: event[0],
            bid: amt.toFixed(2),
            txn: log.tx_hash,
            date: log.block_signed_at,
          };
          console.log(bid);
          if (index < 3) {
            setBids(bids => [...bids, bid]);
          }
          setAllBids(allBids => [...allBids, bid]);
        });
      } else {
        setDuration();
        setTimerHeading();
        setBidHeading();
        setEnded(false);
        setWinner();
      }

      if (address) {
        setBidDisabled(false);
        setSettleDisabled(false);
      }
    } catch (error) {
      console.log("ERROR getAuction", error);
    }
  }

  useEffect(() => {
    if (currentAuction) {
      console.log(
        "🐶 currentAuction gladgo",
        parseInt(tryToDisplay(currentAuction[0])),
        "currentGladId:",
        currentGladId,
      );
      if (currentGladId !== parseInt(tryToDisplay(currentAuction[0]))) {
        getAuction(currentGladId, gladInformation);
      } else {
        var gladInformation_updated = {
          gladId: parseInt(tryToDisplay(currentAuction[0])),
          amount: currentAuction[1],
          startTime: tryToDisplay(currentAuction[2]),
          endTime: tryToDisplay(currentAuction[3]),
          bidder: tryToDisplay(currentAuction[4]),
          settled: currentAuction[5],
        };
        setGladInformation(gladInformation_updated);
        getAuction(undefined, gladInformation_updated);
      }
    }
  }, [currentGladId]);

  useEffect(() => {
    if (currentAuction && !currentGladId) {
      console.log("updating currentGladId");
      setCurrentGladId(parseInt(tryToDisplay(currentAuction[0])));
      console.log("updating gladInformation");
      setGladInformation({
        gladId: parseInt(tryToDisplay(currentAuction[0])),
        amount: currentAuction[1],
        startTime: tryToDisplay(currentAuction[2]),
        endTime: tryToDisplay(currentAuction[3]),
        bidder: tryToDisplay(currentAuction[4]),
        settled: currentAuction[5],
      });
    }
  }, [currentAuction]);

  if (gladInformation.gladId === null) {
    return <p>Loading...</p>;
  }
  if (!contractIsDeployed) {
    return <span>{noContractDisplay}</span>;
  }

  return (
    <div>
      <div className="flex mb-4">
        <a
          target="_blank"
          rel="noreferrer"
          href="https://kovan.etherscan.io/address/0x8B231C8323E448152605B35BEb8c2498731C5D30"
        >
          TREASURY:{" "}
          <span>
            {gladBalanceCDAI && gladBalanceCDAIx
              ? (parseFloat(gladBalanceCDAI / 1e8) + parseFloat(utils.formatEther(gladBalanceCDAIx))).toFixed(4)
              : ""}
          </span>{" "}
          cDAI
        </a>
        <a className="ml-2" target="_blank" rel="noreferrer" href="https://app.superfluid.finance/dashboard">
          YOU: <span>{userBalance ? parseFloat(utils.formatEther(userBalance)).toFixed(4) : ""}</span> cDAI
        </a>
      </div>

      <div className="grid gap-2 grid-cols-12">
        <div className="col-span-12 md:col-span-6">
          <img
            className="w-96 h-96"
            src={`/images/${currentGladId}.png`}
            alt={`Glad ${currentGladId} is a member of the Glads Fighters`}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <h4 className="text-left h-7">
            {gladInformation.startTime ? moment.utc(gladInformation.startTime, "X").format("MMMM D YYYY") : ""}
          </h4>
          <div className="flex">
            <h1 className="text-4xl text-left font-bold w-40">{"Glad " + currentGladId}</h1>
            <div className="flex ml-2 mt-1">
              <Button disabled={currentGladId === 0} onClick={prevGlad} className="mr-1">
                ←
              </Button>
              <Button disabled={currentGladId === 18} onClick={nextGlad}>
                →
              </Button>
            </div>
          </div>
          <div className="grid gap-2 grid-cols-12">
            <div className="col-span-5 text-left">
              <h4 className="text-sm h-4">{bidHeading}</h4>
              <h2 className="text-4xl">{"Ξ " + utils.formatEther(gladInformation.amount)}</h2>
            </div>
            <div className="col-span-7 text-left">
              <h4 className="text-sm h-4 text-left">{winner ? "Winner" : timerHeading}</h4>
              {!winner ? (
                <>
                  {ended ? (
                    <div>
                      <h2 className="text-4xl flex text-left">Auction is over</h2>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-4xl flex text-left">
                        {winner && <h2>{winner}</h2>}
                        <span>
                          {duration ? duration.hours() : "0"}
                          <span className="text-xl">h</span>
                        </span>
                        <span className="pl-2">
                          {duration ? duration.minutes() : "0"}
                          <span className="text-xl">m</span>
                        </span>
                        <span className="pl-2">
                          {duration ? duration.seconds() : "0"}
                          <span className="text-xl">s</span>
                        </span>
                      </h2>
                    </>
                  )}
                </>
              ) : (
                <h2 className="text-4xl">{winner}</h2>
              )}
            </div>
          </div>
          {gladInformation.startTime && (
            <div className="text-left">
              {ended ? (
                gladInformation.settled ? (
                  <div />
                ) : (
                  <div className="input-group">
                    <Button onClick={settleAuction} type="button" disabled={settleDisabled}>
                      Settle Auction
                    </Button>
                  </div>
                )
              ) : (
                <div>
                  <p className="text-xs">{"Minimum bid: " + minBid + " ETH"}</p>
                  <div className="flex">
                    <Input
                      aria-label=""
                      aria-describedby="basic-addon1"
                      min="0"
                      type="number"
                      autoComplete="off"
                      suffix="ETH"
                      value={txValue}
                      onChange={e => setTxValue(e.target.value)}
                    />
                    <Button
                      onClick={bid}
                      disabled={bidLoading || bidDisabled}
                      type="button"
                      className="w-28 ml-2 btn btn-primary"
                    >
                      {bidLoading ? "Bidding ..." : "Bid"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="col-lg-12">
            <ul>
              {bids.map((bid, i) => (
                <li key={i}>
                  <div>
                    <div>
                      <div>
                        <div>{abbrAddress(bid.bidder)}</div>
                      </div>
                      <div>{moment(bid.date).format("MMMM DD [at] HH:mm")}</div>
                    </div>
                    <div>
                      <div>Ξ ${bid.bid}</div>
                      <div>
                        <a href={`https://kovan.etherscan.io/tx/${bid.txn}`} target="_blank" rel="noreferrer">
                          <svg
                            aria-hidden="true"
                            focusable="false"
                            data-prefix="fas"
                            data-icon="external-link-alt"
                            role="img"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 512 512"
                          >
                            <path
                              fill="currentColor"
                              d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM488,0h-128c-21.37,0-32.05,25.91-17,41l35.73,35.73L135,320.37a24,24,0,0,0,0,34L157.67,377a24,24,0,0,0,34,0L435.28,133.32,471,169c15,15,41,4.5,41-17V24A24,24,0,0,0,488,0Z"
                            ></path>
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
