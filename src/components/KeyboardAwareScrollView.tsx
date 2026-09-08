import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewInstance,
  ScrollViewProps,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


/** Space kept between the bottom of the focused field and the top of the keyboard. */
const DEFAULT_GAP = 24;

const KeyboardFocusContext = createContext<(() => void) | null>(null);

let lastKeyboardTop: number | null = null;

export function useKeyboardFocusReporter() {
  return useContext(KeyboardFocusContext);
}

/** Y position (window coordinates) of the top of the keyboard, or `null` while hidden. */
export function useKeyboardTop(): number | null {
  const insets = useSafeAreaInsets();
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    function handleShow(event: KeyboardEvent) {
      const { screenY, height } = event.endCoordinates;
      if (Platform.OS === 'ios') {
        lastKeyboardTop = screenY;
        setTop(screenY);
        return;
      }
      const screenHeight = Dimensions.get('screen').height;
      const computed = screenHeight - height - insets.bottom;
      lastKeyboardTop = computed > 0 ? computed : screenHeight - height;
      setTop(lastKeyboardTop);
    }
    function handleHide() {
      setTop(null);
    }

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleShow),
            Keyboard.addListener('keyboardWillChangeFrame', handleShow),
            Keyboard.addListener('keyboardWillHide', handleHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleShow),
            Keyboard.addListener('keyboardDidHide', handleHide),
          ];

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [insets.bottom]);

  return top;
}

export function useKeyboardHeight(): number {
  const top = useKeyboardTop();
  return top == null ? 0 : Math.max(0, Dimensions.get('screen').height - top);
}

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  /** Space kept above the keyboard. Defaults to 24. */
  keyboardGap?: number;
}

export const KeyboardAwareScrollView = forwardRef<ScrollViewInstance, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollViewInner(
    {
      children,
      keyboardGap = DEFAULT_GAP,
      keyboardShouldPersistTaps = 'handled',
      scrollEventThrottle = 16,
      onScroll,
      onTouchEnd,
      onTouchStart,
      ...rest
    },
    ref,
  ) {
    const keyboardTop = useKeyboardTop();
    const scrollRef = useRef<ScrollViewInstance | null>(null);
    const offsetY = useRef(0);
    const keyboardTopRef = useRef<number | null>(null);
    const scrolledDuringTouch = useRef(false);
    const [padding, setPadding] = useState(0);

    useImperativeHandle(ref, () => scrollRef.current as ScrollViewInstance, []);
    keyboardTopRef.current = keyboardTop;

    const scrollFocusedIntoView = useCallback(
      (top: number | null) => {
        if (top == null) {
          return;
        }
        const input = TextInput.State.currentlyFocusedInput();
        if (!input) {
          return;
        }
        input.measureInWindow((_x: number, y: number, _width: number, height: number) => {
          const overflow = y + height + keyboardGap - top;
          if (overflow > 0) {
            scrollRef.current?.scrollTo({ y: offsetY.current + overflow, animated: true });
          }
        });
      },
      [keyboardGap],
    );

    // Make room at the bottom of the content for whatever the keyboard covers,
    // then lift the focused field above it.
    const applyForTop = useCallback(
      (top: number) => {
        const node = scrollRef.current;
        if (!node) {
          return;
        }
        node.measureInWindow((_x: number, y: number, _width: number, height: number) => {
          setPadding(Math.max(0, y + height - top));
          setTimeout(() => scrollFocusedIntoView(top), 60);
        });
      },
      [scrollFocusedIntoView],
    );

    useEffect(() => {
      if (keyboardTop == null) {
        setPadding(0);
        return;
      }
      applyForTop(keyboardTop);
    }, [keyboardTop, applyForTop]);

    const reportFocus = useCallback(() => {
      const run = () => {
        if (!TextInput.State.currentlyFocusedInput()) {
          if (keyboardTopRef.current == null) {
            setPadding(0);
          }
          return;
        }
        applyForTop(
          keyboardTopRef.current ?? lastKeyboardTop ?? Dimensions.get('screen').height * 0.55,
        );
      };
      setTimeout(run, 120);
      setTimeout(run, 450);
    }, [applyForTop]);

    const handleTouchEnd = useCallback(
      (event: GestureResponderEvent) => {
        if (!scrolledDuringTouch.current) {
          reportFocus();
        }
        onTouchEnd?.(event);
      },
      [reportFocus, onTouchEnd],
    );

    const handleTouchStart = useCallback(
      (event: GestureResponderEvent) => {
        scrolledDuringTouch.current = false;
        onTouchStart?.(event);
      },
      [onTouchStart],
    );

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrolledDuringTouch.current = true;
        offsetY.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      },
      [onScroll],
    );

    return (
      <KeyboardFocusContext.Provider value={reportFocus}>
        <ScrollView
          {...rest}
          ref={scrollRef}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          scrollEventThrottle={scrollEventThrottle}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          {children}
          <View style={{ height: padding }} />
        </ScrollView>
      </KeyboardFocusContext.Provider>
    );
  },
);
