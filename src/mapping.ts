import { ipfs, json, JSONValue, log, TypedMap } from '@graphprotocol/graph-ts'
import { Transfer, Erc721 } from '../generated/Collectible/Erc721'
import { Collectible, User } from '../generated/schema'
import { BASE_IPFS_URL, getIpfsURL, HTTP_SCHEME, IPFS_SCHEME, getDwebURL, COZY_ADDRESS } from './utils'

export function handleTransfer(event: Transfer): void {
  log.info('Parsing Transfer for txHash {}', [event.transaction.hash.toHexString()])

  let collectible = Collectible.load(event.params.tokenId.toString())
  if (!collectible) {
    collectible = new Collectible(event.params.tokenId.toString())
  }

  let erc721Token = Erc721.bind(event.address)
  let tokenURIResult = erc721Token.try_tokenURI(event.params.tokenId)
  if (tokenURIResult.reverted) {
    return
  }
  
  let tokenURI = tokenURIResult.value
  
  let contentPath: string
  if (tokenURI.startsWith(HTTP_SCHEME)) {
    contentPath = tokenURI.split(BASE_IPFS_URL).join('')
  } else if (tokenURI.startsWith(IPFS_SCHEME)) {
    contentPath = tokenURI.split(IPFS_SCHEME).join('')
  } else {
    return
  }

  let data = ipfs.cat(contentPath)
  if (!data) return

  let jsonResult = json.try_fromBytes(data!)
  if (jsonResult.isError) return

  let value = jsonResult.value.toObject()
  if (data != null) {
    let name = value.get('name')
    if (name != null) {
      collectible.name = name.toString()
    } else {
      return
    }

    let description = value.get('description')
    if (description != null) {
      collectible.description = description.toString()
    } else {
      return
    }

    let image = value.get('image')
    if (image != null) {
      let imageStr = image.toString()
      if (imageStr.includes(IPFS_SCHEME)) {
        if (event.address.toHexString() == COZY_ADDRESS) {
          imageStr = getDwebURL(imageStr)
        }
        imageStr = getIpfsURL(imageStr)
      }
      collectible.imageURL = imageStr
    } else {
      return
    }
  }

  let name = erc721Token.try_name()
  if (!name.reverted) {
    collectible.collectionName = name.value
  }

  let symbol = erc721Token.try_symbol()
  if (!symbol.reverted) {
    collectible.collectionSymbol = symbol.value
  }

  collectible.owner = event.params.to.toHexString()
  collectible.collectionAddress = event.address
  collectible.save()

  let user = User.load(event.params.to.toHexString())
  if (!user) {
    user = new User(event.params.to.toHexString())
    user.save()
  }
}