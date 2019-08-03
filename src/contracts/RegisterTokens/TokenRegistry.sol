pragma solidity ^0.4.24;

contract Owned {
    address public owner;

    event OwnershipTransferred(address indexed _from, address indexed _to);

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0x0));
        emit OwnershipTransferred(owner,_newOwner);
        owner = _newOwner;
    }

}

contract TokenRegistry is Owned {

    struct Listing {
        string  tokenName;
        string  tokenSymbol;
        string  tokenLogo;          // IPFS hash of token image
        uint8   tokenDecimals;
        uint8   tokenVersion;
    }

    mapping(address => Listing) public Listings;

    event ListingCreated(address indexed _tokenAddress, string _tokenName, string _tokenSymbol, string _tokenLogo, uint8 _tokenDecimals, uint8 _tokenVersion);
    event ListingUpdated(address indexed _tokenAddress, string _tokenName, string _tokenSymbol, string _tokenLogo, uint8 _tokenDecimals, uint8 _tokenVersion);
    event ListingDeleted(address indexed _tokenAddress);

    function addListing(address _tokenAddress, string _tokenName, string _tokenSymbol, string _tokenLogo, uint8 _tokenDecimals, uint8 _tokenVersion) public onlyOwner {
        Listing memory listing;
        listing.tokenName = _tokenName;
        listing.tokenSymbol = _tokenSymbol;
        listing.tokenLogo = _tokenLogo;
        listing.tokenDecimals = _tokenDecimals;
        listing.tokenVersion = _tokenVersion;

        Listings[_tokenAddress] = listing;
        emit ListingCreated(_tokenAddress, _tokenName, _tokenSymbol, _tokenLogo, _tokenDecimals, _tokenVersion);
    }

    function updateListing(address _tokenAddress, string _tokenName, string _tokenSymbol, string _tokenLogo, uint8 _tokenDecimals, uint8 _tokenVersion) public onlyOwner {
        Listings[_tokenAddress].tokenName = _tokenName;
        Listings[_tokenAddress].tokenSymbol = _tokenSymbol;
        Listings[_tokenAddress].tokenLogo = _tokenLogo;
        Listings[_tokenAddress].tokenDecimals = _tokenDecimals;
        Listings[_tokenAddress].tokenVersion = _tokenVersion;

        emit ListingUpdated(_tokenAddress, _tokenName, _tokenSymbol, _tokenLogo, _tokenDecimals, _tokenVersion);
    }

    function deleteListing(address _tokenAddress) public onlyOwner {
        delete Listings[_tokenAddress];

        emit ListingDeleted(_tokenAddress);
    }

    function getListing(address _tokenAddress) public view returns(string memory, string memory, string memory, uint8, uint8) {
        return (Listings[_tokenAddress].tokenName, Listings[_tokenAddress].tokenSymbol, Listings[_tokenAddress].tokenLogo, Listings[_tokenAddress].tokenDecimals, Listings[_tokenAddress].tokenVersion);
    }
}