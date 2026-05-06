import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const turnTrackerStyles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pageHeader: {
    position: 'absolute',
    // Aligned to the back button's vertical centre. BackButton sits at top: 60
    // with height 40 (centre y ≈ 80); a 32 px font with this top value lands
    // the text's optical centre at the same line.
    top: 65,
    left: 0,
    right: 0,
    zIndex: 9,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.themeYellow,
    textAlign: 'center',
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.themeYellow,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  groupPickerWrap: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  // ── Seating circle ──────────────────────────────────────────
  circleWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // Sit close to the heading above so heading + circle read as one block.
    marginTop: 4,
    marginBottom: 8,
  },
  circleStage: {
    position: 'relative',
    alignSelf: 'center',
  },
  // ── Seats ──────────────────────────────────────────────────
  seatContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatCircle: {
    backgroundColor: Colors.teamCardBackground,
    borderWidth: 2,
    borderColor: Colors.themeBrownDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  seatCircleEmpty: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: Colors.themeYellow,
  },
  seatCircleActive: {
    borderColor: Colors.themeYellow,
    borderWidth: 4,
    shadowColor: Colors.themeYellow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  seatInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.themeBrownDark,
  },
  seatPlaceholderText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.themeYellow,
  },
  seatLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.themeYellow,
    textAlign: 'center',
    textShadowColor: Colors.black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // ── Marker ─────────────────────────────────────────────────
  markerTouchable: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Direction toggle ───────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 22,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.themeYellow,
  },
  toggleSegment: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  toggleSegmentActive: {
    backgroundColor: Colors.themeYellow,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.themeYellow,
  },
  toggleTextActive: {
    color: Colors.themeBrownDark,
  },
  // ── Primary CTAs ───────────────────────────────────────────
  primaryButton: {
    backgroundColor: Colors.themeGreen,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    marginTop: 12,
    borderWidth: 2,
    borderColor: Colors.themeYellow,
  },
  // Full-width variant of `primaryButton`. Used for the Begin Game and Pick
  // First Turn CTAs so they read as the dominant actions on the setup view.
  primaryButtonWide: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.grayDisabled,
    borderColor: Colors.grayLight,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.themeYellow,
  },
  // Container for the side-by-side full-width CTAs on the setup view
  // ([Pick First Turn] [Begin Game]). When Pick First Turn is hidden the
  // remaining Begin Game button stretches to fill the row.
  setupCtaRow: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 20,
    // Sit a comfortable distance below the seating circle so the CTAs feel
    // like a separate action zone rather than crowding the visual.
    marginTop: 56,
    gap: 12,
  },
  // Flex variant of `primaryButton` for use inside `setupCtaRow`. Each button
  // takes an equal share of the row; if there's only one, it spans the full
  // width.
  primaryButtonFlex: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    marginTop: 0,
  },
  // Variant used to pick a different background on the secondary action.
  primaryButtonSecondary: {
    backgroundColor: Colors.wheelGreen,
  },
  // ── In-game CTA row (Add Game Score / Timer) ───────────────
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 32,
    paddingHorizontal: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.wheelGreen,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  ctaButtonAlt: {
    backgroundColor: Colors.wheelOrange,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },
  // Wrapper for the End Game CTA so it can match the visual width of the two
  // CTAs above it (Add Score + Timer) and feel symmetric.
  endGameWrap: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  endGameButton: {
    // Match the canonical "dark brown secondary button" pattern used
    // elsewhere (see scoreTrackerStyles.secondaryButton): solid dark-brown
    // fill, rounded corners, soft drop shadow, no border. Yellow label sits
    // on top for contrast.
    backgroundColor: Colors.themeBrownDark,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    // Sit a little lower below the CTA row.
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // No `alignSelf: 'stretch'` — the screen sets an explicit width based on
    // the measured CTA row width so the button visually matches the combined
    // span of the two pills above it.
  },
  endGameText: {
    color: Colors.themeYellow,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // ── Bottom toolbar ─────────────────────────────────────────
  // (The toolbar component was removed in favour of in-flow CTA buttons.)
  // ── Player picker modal ────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#2a1a0a',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: Colors.themeYellow,
    overflow: 'hidden',
  },
  modalHeader: {
    color: Colors.themeYellow,
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    textAlign: 'center',
  },
  modalRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251, 232, 201, 0.1)',
  },
  modalRowDisabled: {
    opacity: 0.4,
  },
  modalRowSelected: {
    backgroundColor: 'rgba(251, 232, 201, 0.18)',
  },
  modalRowText: {
    color: Colors.themeYellow,
    fontSize: 16,
  },
  modalRowSubtext: {
    color: Colors.grayDark,
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251, 232, 201, 0.15)',
  },
  modalActionText: {
    color: Colors.themeYellow,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalActionDanger: {
    color: Colors.timerRed,
  },
});
