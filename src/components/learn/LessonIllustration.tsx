import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { Lesson } from '@/learn/lessons';
import { useTheme } from '@/theme';

type LessonId = Lesson['id'];

export function LessonIllustration({ id, title }: { id: LessonId; title: string }) {
  const theme = useTheme();
  const surface = theme.background;
  const soft = theme.buttonSecondary;
  const blue = theme.tint;
  const ink = theme.text;
  const muted = theme.textSecondary;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Illustration for ${title}`} style={[styles.frame, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 190" accessible={false}>
        <Rect width={360} height={190} fill={theme.card} />
        <Circle cx={18} cy={170} r={72} fill={blue} opacity={0.055} />
        <Circle cx={344} cy={15} r={75} fill={blue} opacity={0.055} />
        {id === 'deepfake-faces' && <>
          <Rect x={43} y={23} width={218} height={144} rx={17} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Circle cx={59} cy={38} r={3} fill={theme.danger} />
          <Circle cx={70} cy={38} r={3} fill={theme.warning} />
          <Circle cx={81} cy={38} r={3} fill={theme.success} />
          <Path d="M83 158c2-26 23-39 57-39s55 13 57 39" fill={soft} />
          <Ellipse cx={140} cy={83} rx={30} ry={35} fill={soft} />
          <Path d="M111 78c2-24 15-35 31-35 19 0 30 14 29 34-9-3-17-10-21-17-8 11-21 17-39 18Z" fill={ink} opacity={0.82} />
          <Circle cx={130} cy={84} r={2.3} fill={ink} />
          <Circle cx={151} cy={84} r={2.3} fill={ink} />
          <Path d="M134 99c4 3 9 3 13 0" fill="none" stroke={muted} strokeWidth={2} strokeLinecap="round" />
          <Path d="M91 65v-9h14M176 56h14v9M91 105v10h14M176 115h14v-10" fill="none" stroke={blue} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x={277} y={70} width={48} height={66} rx={13} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Path d="M290 87h21M290 96h15M290 105h18" stroke={muted} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={298} cy={48} r={20} fill={theme.danger} />
          <Path d="M298 38v12M298 56v1" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        </>}
        {id === 'ai-images' && <>
          <Rect x={39} y={26} width={226} height={140} rx={16} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Rect x={49} y={36} width={206} height={120} rx={11} fill={soft} />
          <Circle cx={205} cy={65} r={17} fill={theme.warning} opacity={0.9} />
          <Path d="m50 132 50-46 34 30 35-42 86 65H50Z" fill={blue} opacity={0.72} />
          <Path d="m52 145 53-32 34 23 33-20 82 40H52Z" fill={blue} opacity={0.42} />
          <Path d="m75 53 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8ZM237 91l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#FFFFFF" opacity={0.9} />
          <Circle cx={276} cy={119} r={29} fill={surface} stroke={blue} strokeWidth={5} />
          <Path d="m297 141 21 21" stroke={blue} strokeWidth={8} strokeLinecap="round" />
          <Circle cx={276} cy={119} r={12} fill={soft} />
        </>}
        {id === 'voice-clones' && <>
          <Path d="M63 84c-18-18-18-43 0-61M81 73c-10-10-10-29 0-39" fill="none" stroke={blue} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
          <Path d="M297 23c18 18 18 43 0 61M279 34c10 10 10 29 0 39" fill="none" stroke={blue} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
          <Rect x={122} y={14} width={116} height={162} rx={22} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Rect x={158} y={21} width={44} height={5} rx={2.5} fill={theme.border} />
          <Circle cx={180} cy={61} r={20} fill={soft} />
          <Path d="M149 102c1-16 13-25 31-25s30 9 31 25" fill={blue} opacity={0.72} />
          <Path d="M153 118h54M164 128h32" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar, index) => {
            const heights = [9, 19, 28, 16, 35, 22, 30, 13, 24, 16, 8];
            return <Rect key={bar} x={145 + index * 7} y={154 - heights[index] / 2} width={3.5} height={heights[index]} rx={1.75} fill={index === 5 ? theme.warning : blue} opacity={index === 5 ? 1 : 0.76} />;
          })}
          <Circle cx={277} cy={139} r={21} fill={theme.warning} />
          <Path d="M277 128v13M277 147v1" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        </>}
        {id === 'scams-fraud' && <>
          <Rect x={45} y={24} width={224} height={144} rx={17} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Circle cx={67} cy={47} r={11} fill={soft} />
          <Path d="M86 43h89M86 51h61" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
          <Rect x={61} y={70} width={190} height={39} rx={11} fill={soft} />
          <Path d="M75 83h127M75 95h91" stroke={muted} strokeWidth={4} strokeLinecap="round" opacity={0.72} />
          <Rect x={61} y={119} width={157} height={31} rx={9} fill={blue} opacity={0.12} />
          <Path d="M75 135h92" stroke={blue} strokeWidth={4} strokeLinecap="round" />
          <Path d="m235 92 26-18" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={288} cy={68} r={22} fill={theme.danger} />
          <Path d="M288 57v13M288 76v1" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
          <Path d="m278 119 12 12 20-22" fill="none" stroke={theme.success} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {id === 'harmful-content' && <>
          <Rect x={47} y={24} width={186} height={143} rx={17} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Circle cx={70} cy={47} r={11} fill={soft} />
          <Path d="M89 43h82M89 51h54" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
          <Rect x={61} y={68} width={158} height={68} rx={11} fill={theme.danger} opacity={0.12} />
          <Path d="M77 84h112M77 96h93M77 108h75" stroke={theme.danger} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
          <Path d="M276 47 319 64v31c0 28-19 43-43 54-24-11-43-26-43-54V64l43-17Z" fill={blue} opacity={0.17} stroke={blue} strokeWidth={3} />
          <Path d="m256 96 14 14 27-31" fill="none" stroke={theme.success} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={285} cy={35} r={14} fill={theme.warning} />
          <Path d="M285 28v8M285 41v1" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
        </>}
        {id === 'verify-sharing' && <>
          <Rect x={33} y={36} width={111} height={120} rx={13} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Rect x={216} y={36} width={111} height={120} rx={13} fill={surface} stroke={theme.border} strokeWidth={1.5} />
          <Rect x={45} y={49} width={87} height={45} rx={8} fill={soft} />
          <Circle cx={113} cy={61} r={7} fill={theme.warning} />
          <Path d="m46 88 24-20 17 14 13-11 32 23H46Z" fill={blue} opacity={0.7} />
          <Rect x={228} y={49} width={87} height={45} rx={8} fill={soft} />
          <Circle cx={296} cy={61} r={7} fill={theme.warning} />
          <Path d="m229 88 24-20 17 14 13-11 32 23h-86Z" fill={blue} opacity={0.7} />
          <Path d="M48 108h59M48 119h73M230 108h59M230 119h73" stroke={theme.border} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={180} cy={91} r={34} fill={surface} stroke={blue} strokeWidth={5} />
          <Path d="m205 116 24 24" stroke={blue} strokeWidth={8} strokeLinecap="round" />
          <Path d="m166 91 10 10 19-21" fill="none" stroke={theme.success} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </>}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 190, width: '100%', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: 8, marginBottom: 8 },
});
