import {
  Box,
  Flex,
  Spinner,
  Switch,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';
import { AddToMetamask } from 'components/common/AddToMetamask';
import { Logo } from 'components/common/Logo';
import { BridgeContext } from 'contexts/BridgeContext';
import { useWeb3Context } from 'contexts/Web3Context';
import { BigNumber, utils } from 'ethers';
import { useBridgeDirection } from 'hooks/useBridgeDirection';
import { fetchToToken } from 'lib/bridge';
import {
  NATIVE_CURRENCY_CHAIN_IDS,
  NATIVE_CURRENCY_SYMBOLS,
  WRAPPED_CURRENCY_SYMBOLS,
} from 'lib/constants';
import { formatValue, getNativeCurrency, logError } from 'lib/helpers';
import { ETH_XDAI_BRIDGE } from 'lib/networks';
import { fetchTokenBalance } from 'lib/token';
import React, { useContext, useEffect, useState } from 'react';
import { defer } from 'rxjs';

export const ToToken = () => {
  const { account, providerChainId } = useWeb3Context();
  const { getBridgeChainId, bridgeDirection } = useBridgeDirection();
  const {
    updateBalance,
    fromToken,
    toToken: token,
    toAmount: amount,
    toAmountLoading: loading,
    toBalance: balance,
    setToBalance: setBalance,
    shouldReceiveNativeCur,
    setShouldReceiveNativeCur,
    setToToken,
    setLoading,
  } = useContext(BridgeContext);
  const chainId = getBridgeChainId(providerChainId);

  const smallScreen = useBreakpointValue({ base: true, lg: false });
  const [balanceLoading, setBalanceLoading] = useState(false);

  const changeToToken = async () => {
    setLoading(true);
    setShouldReceiveNativeCur(!shouldReceiveNativeCur);
    setToToken(
      shouldReceiveNativeCur
        ? await fetchToToken(bridgeDirection, fromToken, chainId)
        : getNativeCurrency(chainId),
    );
    setLoading(false);
  };

  useEffect(() => {
    let subscription;
    if (token && account && chainId === token.chainId) {
      setBalanceLoading(true);
      subscription = defer(() =>
        fetchTokenBalance(token, account).catch(toBalanceError => {
          logError({ toBalanceError });
          setBalance(BigNumber.from(0));
          setBalanceLoading(false);
        }),
      ).subscribe(b => {
        setBalance(b);
        setBalanceLoading(false);
      });
    } else {
      setBalance(BigNumber.from(0));
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [updateBalance, token, account, setBalance, setBalanceLoading, chainId]);

  return (
    <Flex
      align="center"
      m={{ base: 2, lg: 0 }}
      ml={{ base: 2, lg: -6 }}
      position="relative"
      borderRadius="0.25rem"
      background={{ base: '#EEF4FD', lg: 'transparent' }}
      minH={smallScreen ? '5rem' : 8}
      minW={smallScreen ? '15rem' : undefined}
    >
      {!smallScreen && (
        <svg width="100%" viewBox="0 0 381 94" fill="none">
          <path
            d="M20.806 4.484A8 8 0 0127.992 0H373a8 8 0 018 8v78a8 8 0 01-8 8H27.992a8 8 0 01-7.186-4.484l-19.085-39a8 8 0 010-7.032l19.085-39z"
            fill="#EEF4FD"
          />
        </svg>
      )}
      {token && (
        <Flex
          position={{ base: 'relative', lg: 'absolute' }}
          h={{ base: 'auto', lg: '100%' }}
          w="100%"
          direction="column"
          py={4}
          pr={4}
          pl={{ base: 4, lg: 12 }}
        >
          <Flex
            justify="space-between"
            align={{ base: 'stretch', sm: 'center', lg: 'flex-start' }}
            mb={2}
            direction={{ base: 'column', sm: 'row' }}
          >
            <Flex align="center">
              <Flex
                justify="center"
                align="center"
                background="white"
                border="1px solid #DAE3F0"
                w={8}
                h={8}
                overflow="hidden"
                borderRadius="50%"
                mr={2}
              >
                <Logo uri={token.logoURI} reverseFallback />
              </Flex>
              <Text fontSize="lg" fontWeight="bold">
                {token.name}
              </Text>
              {!NATIVE_CURRENCY_SYMBOLS.includes(token.symbol) && (
                <AddToMetamask token={token} ml="0.5rem" asModal />
              )}
            </Flex>
            <Flex
              flex={1}
              justify="flex-end"
              align="center"
              h="100%"
              position="relative"
              ml={{ base: undefined, sm: 2, md: undefined }}
            >
              {balanceLoading ? (
                <Spinner size="sm" color="grey" />
              ) : (
                <Flex
                  {...(smallScreen
                    ? {}
                    : { position: 'absolute', bottom: '4px', right: 0 })}
                  justify="flex-end"
                  align="center"
                >
                  <Text color="grey" textAlign="right">
                    {`Balance: ${formatValue(balance, token.decimals)}`}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
          <Flex
            width="100%"
            justifyContent="space-between"
            direction="row"
            alignItems="center"
            flex={1}
            {...(!smallScreen
              ? {
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  pl: 12,
                  pr: 4,
                  pb: 4,
                }
              : {})}
            h="52px"
          >
            {loading ? (
              <Box mt={{ base: 2, lg: 0 }} mb={{ base: 1, lg: 0 }}>
                <Spinner color="black" size="sm" />
              </Box>
            ) : (
              <Text fontWeight="bold" fontSize="2xl">
                {utils.formatUnits(amount, token.decimals)}
              </Text>
            )}
            {bridgeDirection !== ETH_XDAI_BRIDGE && // Temporary block and will be removed once the audit is finished.
              WRAPPED_CURRENCY_SYMBOLS.includes(fromToken.symbol) &&
              NATIVE_CURRENCY_CHAIN_IDS.includes(chainId) && (
                <Flex>
                  <Text>Receive Native Currency</Text>
                  <Switch
                    ml={2}
                    colorScheme="blue"
                    isChecked={shouldReceiveNativeCur}
                    onChange={changeToToken}
                  />
                </Flex>
              )}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};
