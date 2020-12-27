import {
  Box,
  Button,
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ClaimTokenImage from '../assets/claim.svg';
import ErrorImage from '../assets/error.svg';
import InfoImage from '../assets/info.svg';
import ClaimTokensImage from '../assets/multiple-claim.svg';
import { Web3Context } from '../contexts/Web3Context';
import {
  executeSignatures,
  getMessageFromMessageID,
  getMessageStatus,
} from '../lib/amb';
import { HOME_NETWORK, POLLING_INTERVAL } from '../lib/constants';
import {
  getBridgeNetwork,
  getNetworkName,
  isxDaiChain,
  logError,
} from '../lib/helpers';
import { useClaimableTransfers } from '../lib/history';
import { LoadingModal } from './LoadingModal';

export const ClaimTokensModal = () => {
  const { ethersProvider, providerChainId } = useContext(Web3Context);
  const { transfers, loading } = useClaimableTransfers();
  const [claiming, setClaiming] = useState(false);
  const [needsClaim, setNeedsClaim] = useState([]);
  const [isOpen, setOpen] = useState(false);
  const [transfer, setTransfer] = useState();
  const isxDai = isxDaiChain(providerChainId);
  const { message: msg, symbol, receivingTx, sendingTx } = transfer || {};
  const [executed, setExecuted] = useState(false);

  const onClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    const claimTokens = parseInt(
      window.sessionStorage.getItem('claimTokens'),
      10,
    );
    if (transfers) {
      setNeedsClaim(transfers);
      if (transfers.length === 1) {
        setTransfer(transfers[0]);
      }
      if (!isxDai && (isNaN(claimTokens) || claimTokens < transfers.length)) {
        setOpen(transfers.length > 0);
        window.sessionStorage.setItem('claimTokens', transfers.length);
      }
    } else {
      onClose();
    }
  }, [transfers, isxDai]);

  const claimable =
    !isxDai && !claiming && msg && msg.msgData && msg.signatures && !executed;

  const claimTokens = async () => {
    if (!claimable) return;
    setClaiming(true);
    try {
      executeSignatures(ethersProvider, providerChainId, msg);
    } catch (executeError) {
      setClaiming(false);
      logError({ executeError });
    }
  };

  useEffect(() => {
    const subscriptions = [];
    const unsubscribe = () => {
      subscriptions.forEach(s => {
        clearTimeout(s);
      });
    };

    if (!msg || !msg.messageId || isxDai) return unsubscribe;
    let status = false;

    const getStatus = async () => {
      try {
        if (!msg.signatures) {
          unsubscribe();
          getMessageFromMessageID(
            getBridgeNetwork(providerChainId),
            msg.messageId,
          ).then(message =>
            setTransfer(t => ({
              ...t,
              message,
            })),
          );
          return;
        }

        status = await getMessageStatus(providerChainId, msg.messageId);
        if (status) {
          unsubscribe();
          window.sessionStorage.setItem('claimTokens', 0);
          setClaiming(false);
          onClose();
          setExecuted(true);
          return;
        }

        if (!status) {
          const timeoutId = setTimeout(() => getStatus(), POLLING_INTERVAL);
          subscriptions.push(timeoutId);
        }
      } catch (statusError) {
        logError({ statusError });
      }
    };
    // unsubscribe from previous polls
    unsubscribe();

    getStatus();
    // unsubscribe when unmount component
    return unsubscribe;
  }, [isxDai, providerChainId, msg]);

  useEffect(() => {
    setExecuted(!!receivingTx);
  }, [receivingTx]);

  if (loading || claiming)
    return (
      <LoadingModal
        loadingText={claiming ? 'Waiting for Execution' : ''}
        txHash={sendingTx}
      />
    );
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay background="modalBG">
        <ModalContent
          boxShadow="0px 1rem 2rem #617492"
          borderRadius="1rem"
          maxW="33.75rem"
          mx={{ base: 12, lg: 0 }}
        >
          <ModalHeader p={6}>
            <Text>Claim Your Tokens</Text>
            <Image
              src={msg ? ClaimTokenImage : ClaimTokensImage}
              w="100%"
              mt={4}
            />
          </ModalHeader>
          <ModalCloseButton
            size="lg"
            top={-10}
            right={-10}
            color="white"
            p={2}
          />
          <ModalBody px={6} py={0}>
            {msg ? (
              <Flex align="center" direction="column">
                <Flex
                  mt={4}
                  w="100%"
                  borderRadius="4px"
                  border="1px solid #DAE3F0"
                  mb={executed ? 6 : 0}
                >
                  <Flex
                    bg="rgba(83, 164, 255, 0.1)"
                    borderLeftRadius="4px"
                    border="1px solid #53A4FF"
                    justify="center"
                    align="center"
                    minW="4rem"
                    maxW="4rem"
                    flex={1}
                  >
                    <Image src={InfoImage} />
                  </Flex>
                  <Flex align="center" fontSize="12px" p={4}>
                    <Text>
                      {`The claim process may take a variable period of time on ${getNetworkName(
                        getBridgeNetwork(HOME_NETWORK),
                      )} depending on network congestion. Your ${symbol} balance will increase to reflect the completed transfer after the claim is processed`}
                    </Text>
                  </Flex>
                </Flex>
                {executed && (
                  <Flex w="100%" borderRadius="4px" border="1px solid #DAE3F0">
                    <Flex
                      bg="rgba(255, 102, 92, 0.1)"
                      borderLeftRadius="4px"
                      border="1px solid #FF665C"
                      justify="center"
                      align="center"
                      minW="4rem"
                      maxW="4rem"
                      flex={1}
                    >
                      <Image src={ErrorImage} />
                    </Flex>
                    <Flex align="center" fontSize="12px" p={4}>
                      <Text>The withdrawal request was already executed</Text>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            ) : (
              <Flex align="center" direction="column">
                <Box w="100%">
                  <Text as="span">{`You have `}</Text>
                  <Text as="b">{needsClaim.length}</Text>
                  <Text as="span">{` not claimed transactions `}</Text>
                </Box>
              </Flex>
            )}
          </ModalBody>
          <ModalFooter p={6}>
            <Flex
              w="100%"
              justify="space-between"
              align={{ base: 'stretch', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
            >
              <Button
                px={12}
                onClick={onClose}
                background="background"
                _hover={{ background: '#bfd3f2' }}
                color="#687D9D"
              >
                Cancel
              </Button>
              {msg ? (
                <Button
                  px={12}
                  onClick={claimTokens}
                  colorScheme="blue"
                  mt={{ base: 2, md: 0 }}
                  isDisabled={!claimable}
                  isLoading={claiming}
                >
                  Claim
                </Button>
              ) : (
                <Link
                  to="/history"
                  display="flex"
                  onClick={() => {
                    window.sessionStorage.setItem('claimTokens', 0);
                  }}
                >
                  <Button
                    px={12}
                    colorScheme="blue"
                    mt={{ base: 2, md: 0 }}
                    w="100%"
                  >
                    Claim
                  </Button>
                </Link>
              )}
            </Flex>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
};
