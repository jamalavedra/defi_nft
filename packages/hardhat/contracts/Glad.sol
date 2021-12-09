// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import {ISuperfluid, ISuperToken, ISuperApp, ISuperAgreement, SuperAppDefinitions} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

interface Erc20 {
    function approve(address, uint256) external returns (bool);

    function transfer(address, uint256) external returns (bool);

    function balanceOf(address) external returns (uint256);

    function decimals() external returns (uint8);
}

interface CErc20 {
    function mint(uint256) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function supplyRatePerBlock() external returns (uint256);

    function redeem(uint256) external returns (uint256);

    function redeemUnderlying(uint256) external returns (uint256);

    function approve(address, uint256) external returns (bool);

    function balanceOf(address) external returns (uint256);

    function decimals() external returns (uint8);
}

interface ICompoundComptroller {
    function claimComp(address holder) external;
}

contract Glad is ERC721, Ownable {
    using SafeMath for uint256;

    AggregatorV3Interface internal priceFeed;
    IUniswapRouter public constant uniswapRouter =
        IUniswapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    address private constant WETH9 = 0xd0A1E359811322d97991E03f863a0C30C2cF029C;
    address private constant DAI = 0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa;
    address private constant cDAI = 0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD;
    address private constant cDAIx = 0x3ED99f859D586e043304ba80d8fAe201D4876D57;
    address private constant comptroller =
        0x5eAe89DC1C671724A672ff0630122ee834098657;

    ISuperfluid private _host; // host
    IConstantFlowAgreementV1 private _cfa; // the stored constant flow agreement class address
    ISuperToken private _acceptedToken; // accepted token

    // An address who has permissions to mint Glads
    address public minter;

    mapping(uint256 => uint256) public winningBid;
    mapping(uint256 => uint256) public cTokensForGlad;

    mapping(uint256 => int96) public flowRates;
    struct Flow {
        uint256 tokenId;
        uint256 timestamp;
        int96 flowRate;
    }
    mapping(uint256 => Flow[]) private flowsForToken;

    uint256 public lastId; // this is so we can increment the number

    // IPFS content hash of contract-level metadata
    string private _contractURIHash =
        "QmYuKfPPTT14eTHsiaprGrTpuSU5Gzyq7EjMwwoPZvaB6o";

    modifier onlyMinter() {
        require(msg.sender == minter, "Sender is not the minter");
        _;
    }
    modifier onlyMinterOrOwner() {
        require(
            (msg.sender == minter) || (msg.sender == owner()),
            "Sender is not the minter nor owner"
        );
        _;
    }

    constructor()
        // hardcoding to make testing faster
        ERC721(
            "Cypto Glad", //_name,
            "GLD" //_symbol
        )
    {
        _host = ISuperfluid(0xF0d7d1D47109bA426B9D8A3Cde1941327af1eea3);
        _cfa = IConstantFlowAgreementV1(
            0xECa8056809e7e8db04A8fF6e4E82cD889a46FE2F
        );
        _acceptedToken = ISuperToken(cDAIx);

        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));
        assert(address(_acceptedToken) != address(0));

        // chainlink ETH/DAI on Kovan
        priceFeed = AggregatorV3Interface(
            0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541
        );
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return "https://glad.jamalavedra.me/meta/";
    }

    /**
     * Returns the latest price
     */
    function _chainlink_price() internal returns (int256) {
        (
            uint80 roundID,
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return price;
    }

    function _swap(uint256 amountIn) internal returns (uint256) {
        uint256 min = uint256(_chainlink_price());
        min = min.mul(97);
        min = min.div(100);

        uint256 deadline = block.timestamp + 15;
        address tokenIn = WETH9;
        address tokenOut = DAI;
        uint24 fee = 3000;
        address recipient = address(this);
        uint256 amountOutMinimum = min;
        uint160 sqrtPriceLimitX96 = 0;

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams(
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                amountIn,
                amountOutMinimum,
                sqrtPriceLimitX96
            );

        uint256 amountOut = uniswapRouter.exactInputSingle{value: amountIn}(
            params
        );
        uniswapRouter.refundETH();

        return amountOut;
    }

    function _comp(uint256 tokens) internal returns (uint256) {
        // Create a reference to the underlying asset contract, like DAI.
        Erc20 underlying = Erc20(DAI);

        // Create a reference to the corresponding cToken contract, like cDAI
        CErc20 cToken = CErc20(cDAI);

        uint256 _numTokensBefore = cToken.balanceOf(address(this));

        uint256 _numTokensToSupply = tokens;

        // Approve transfer on the ERC20 contract
        underlying.approve(cDAI, _numTokensToSupply);

        // Mint cTokens
        uint256 mintResult = cToken.mint(_numTokensToSupply); // does not return number of cTokens

        uint256 _numTokensAfter = cToken.balanceOf(address(this));
        uint256 cTokens = _numTokensAfter.sub(_numTokensBefore);

        return cTokens;
    }

    function claimComp() external onlyOwner {
        _claimComp();
    }

    function _claimComp() internal {
        ICompoundComptroller troll = ICompoundComptroller(comptroller);
        troll.claimComp(address(this));
    }

    function _super(uint256 cTokens) internal {
        // Create a reference to the underlying asset contract, like DAI.
        CErc20 underlying = CErc20(cDAI);

        //uint256 _numTokensToSupply = underlying.balanceOf(address(this));
        uint256 _numTokensToSupply = cTokens;

        uint256 amount = _numTokensToSupply *
            (10**(18 - underlying.decimals()));

        // Approve transfer on the ERC20 contract
        underlying.approve(cDAIx, _numTokensToSupply);

        // Mint super tokens
        _acceptedToken.upgrade(amount);
    }

    function _defi(uint256 amount, uint256 tokenId) internal {
        uint256 tokens = _swap(amount); // ETH for DAI
        uint256 cTokens = _comp(tokens); // DAI for cDAI
        cTokensForGlad[tokenId] = cTokens.mul(1e10);
        _super(cTokens.div(10)); // 10% of cDAI upgraded to cDAIx
    }

    // temporary functions for dev because I keep losing all my faucet ETH to older versions of contracts!!
    function withdrawToken(address _tokenContract) external onlyOwner {
        IERC20 tokenContract = IERC20(_tokenContract);

        // transfer the token from address of this contract
        // to address of the user (executing the withdrawToken() function)
        tokenContract.transfer(
            msg.sender,
            tokenContract.balanceOf(address(this))
        );
    }

    function withdrawETH() external payable onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    // @dev creates the NFT, but it remains in the contract
    function mint() external onlyMinterOrOwner returns (uint256) {
        //flowRates[lastId] = flowRate;
        _mint(address(this), lastId);
        uint256 gladId = lastId;
        lastId += 1;
        return gladId;
    }

    event NFTIssued(uint256 indexed tokenId, address indexed owner);

    // @dev issues the NFT, transferring it to a new owner, and starting the stream
    function issue(
        address newOwner,
        uint256 tokenId,
        uint256 amount
    ) external payable onlyMinterOrOwner {
        require(newOwner != address(this), "Issue to a new address");
        require(ownerOf(tokenId) == address(this), "NFT already issued");
        if (msg.value > 0) {
            _defi(msg.value, tokenId);
        }
        winningBid[tokenId] = amount;
        _claimComp();
        emit NFTIssued(tokenId, newOwner);
        this.safeTransferFrom(address(this), newOwner, tokenId);
    }

    function close(uint256 tokenId) external {
        int96 closedFlowRate = _closeStreamsForToken(tokenId);
        flowRates[tokenId] -= closedFlowRate;
        IERC20 tokenContract = IERC20(cDAIx);
        // reward equivalent of 30 days of closed flow: 60*60*24*30 = 2592000
        tokenContract.transfer(
            msg.sender,
            uint256(uint96(closedFlowRate)).mul(2592000)
        );
    }

    function _closeStreamsForToken(uint256 tokenId)
        internal
        returns (int96 closedFlowRate)
    {
        int96 closed = 0;
        for (uint256 i = 0; i < flowsForToken[tokenId].length; i++) {
            if (block.timestamp > flowsForToken[tokenId][i].timestamp) {
                address receiver = ownerOf(flowsForToken[tokenId][i].tokenId);
                int96 flowRate = flowsForToken[tokenId][i].flowRate;
                (, int96 outFlowRate, , ) = _cfa.getFlow(
                    _acceptedToken,
                    address(this),
                    receiver
                );
                if (outFlowRate == flowRate) {
                    _deleteFlow(address(this), receiver);
                } else if (outFlowRate > flowRate) {
                    // reduce the outflow by flowRate
                    _updateFlow(receiver, outFlowRate - flowRate);
                }
                closed += flowRate;
            }
        }
        return closed;
    }

    // executing every time the token is moved, including intial minting
    // When the token is first "issued", i.e. moved from the first contract, it will start the streams
    function _beforeTokenTransfer(
        address oldReceiver,
        address newReceiver,
        uint256 tokenId
    ) internal override {
        require(newReceiver != address(0), "New receiver is zero address");
        // @dev because our app is registered as final, we can't take downstream apps

        if (oldReceiver == address(this)) {
            uint256 _amount = winningBid[tokenId];
            uint256 _super = cTokensForGlad[tokenId];
            flowRates[tokenId] = 0;
            // 10% back to inital owner
            flowsForToken[tokenId].push(
                Flow({
                    tokenId: tokenId,
                    timestamp: block.timestamp + 365 * 24 * 60 * 60,
                    flowRate: int96(uint96(_super.div(10).div(31536000)))
                })
            );
            // shared portion: 40% of proceeds
            for (uint256 i = 0; i < lastId; i++) {
                flowsForToken[tokenId].push(
                    Flow({
                        tokenId: i,
                        timestamp: block.timestamp + 365 * 24 * 60 * 60,
                        flowRate: int96(
                            uint96(
                                _super.div(10).mul(4).div(lastId).div(31536000)
                            )
                        )
                    })
                );
            }
            // 20% to the 10 before Glad owner
            if (tokenId > 9) {
                flowsForToken[tokenId].push(
                    Flow({
                        tokenId: tokenId - 10,
                        timestamp: block.timestamp + 365 * 24 * 60 * 60,
                        flowRate: int96(uint96(_super.div(5).div(31536000)))
                    })
                );
            }

            for (uint256 i = 0; i < flowsForToken[tokenId].length; i++) {
                address receiver = ownerOf(flowsForToken[tokenId][i].tokenId);
                if (flowsForToken[tokenId][i].tokenId == tokenId) {
                    receiver = newReceiver;
                }
                _createOrRedirectFlows(
                    oldReceiver,
                    receiver,
                    flowsForToken[tokenId][i].flowRate
                );
                flowRates[flowsForToken[tokenId][i].tokenId] += flowsForToken[
                    tokenId
                ][i].flowRate;
            }
        } else {
            if (newReceiver != address(this)) {
                // being transferred to new owner - redirect the flow
                _createOrRedirectFlows(
                    oldReceiver,
                    newReceiver,
                    flowRates[tokenId]
                ); // change hard-coded flowrate
            }
        }
    }

    function _createOrRedirectFlows(
        address oldReceiver,
        address newReceiver,
        int96 flowRate
    ) internal {
        // @dev delete flow to old receiver
        (, int96 outFlowRate, , ) = _cfa.getFlow(
            _acceptedToken,
            address(this),
            oldReceiver
        );
        if (outFlowRate == flowRate) {
            _deleteFlow(address(this), oldReceiver);
        } else if (outFlowRate > flowRate) {
            // reduce the outflow by flowRate
            _updateFlow(oldReceiver, outFlowRate - flowRate);
        }

        // @dev create flow to new receiver
        // @dev if this is a new NFT, it will create a flow based on the stored flowrate
        (, outFlowRate, , ) = _cfa.getFlow(
            _acceptedToken,
            address(this),
            newReceiver
        );
        if (outFlowRate == 0) {
            if (newReceiver != address(this)) {
                _createFlow(newReceiver, flowRate);
            }
        } else {
            // increase the outflow by flowRate
            _updateFlow(newReceiver, outFlowRate + flowRate);
        }
    }

    /**************************************************************************
     * Library
     *************************************************************************/
    function _createFlow(address to, int96 flowRate) internal {
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.createFlow.selector,
                _acceptedToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    function _updateFlow(address to, int96 flowRate) internal {
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.updateFlow.selector,
                _acceptedToken,
                to,
                flowRate,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    function _deleteFlow(address from, address to) internal {
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.deleteFlow.selector,
                _acceptedToken,
                from,
                to,
                new bytes(0) // placeholder
            ),
            "0x"
        );
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    /**
     * @notice The IPFS URI of contract-level metadata.
     */
    function contractURI() public view returns (string memory) {
        return string(abi.encodePacked("ipfs://", _contractURIHash));
    }

    /**
     * @notice Set the _contractURIHash.
     * @dev Only callable by the owner.
     */
    function setContractURIHash(string memory newContractURIHash)
        external
        onlyOwner
    {
        _contractURIHash = newContractURIHash;
    }

    receive() external payable {
        //_defi(msg.value);
    }
}
