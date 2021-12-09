// SPDX-License-Identifier: GPL-3.0

/// @title Interface for DegenGladsToken

pragma solidity ^0.8.0;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IGladsToken is IERC721 {
    event GladCreated(uint256 indexed tokenId);

    event GladBurned(uint256 indexed tokenId);

    event MinterUpdated(address minter);

    event MinterLocked();

    function mint() external returns (uint256);

    function issue(
        address newOwner,
        uint256 tokenId,
        uint256 amount
    ) external payable;

    function burn(uint256 tokenId) external;

    function setMinter(address minter) external;

    function lockMinter() external;
}
