import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import moment from 'moment'

const Date = ({ date, onSelectDate, selected, index, size, colors }) => {
    /**
     * use moment to compare the date to today
     * if today, show 'Today'
     * if not today, show day of the week e.g 'Mon', 'Tue', 'Wed'
     */
    const day = moment(date).format('ddd').toUpperCase()
    // get the day number e.g 1, 2, 3, 4, 5, 6, 7
    const dayNumber = moment(date).format('D')

    // get the full date e.g 2021-01-01 - we'll use this to compare the date to the selected date
    const fullDate = moment(date).format('YYYY-MM-DD')
    const today = moment().format('YYYY-MM-DD')

    const styles = StyleSheet.create({
        card: {
            backgroundColor: colors.card,
            borderRadius: 20,
            borderColor: colors.text,
            paddingVertical: 20,
            alignItems: 'center',
            paddingHorizontal: 20,
            width: 85,
            height: 90,


        },
        big: {
            color: colors.text,
            fontSize: 16,
            fontFamily: 'Sora_600SemiBold',

        },
        medium: {
            color: colors.text,
            fontSize: 20,
            fontFamily: 'Sora_700Bold',
        },
    })



    return (
        <TouchableOpacity
            onPress={() => onSelectDate(fullDate)}
            style={[styles.card, {borderWidth: today === fullDate ? 1 : 0}, selected === fullDate && { backgroundColor: colors.text }, date === fullDate && { borderColor: "#000", borderWidth: 1 }, index === size-1 && { marginRight: 4 }, index !== 0 && { marginLeft: 4 }]}
        >
            <Text
                style={[styles.big, selected === fullDate && { color: colors.background }]}
            >
                {day}
            </Text>
            <View style={{ height: 5 }} />
            <Text
                style={[
                    styles.medium,
                    selected === fullDate && { color: colors.background, fontSize: 20 },
                ]}
            >
                {dayNumber}
            </Text>
        </TouchableOpacity>
    )
}

export default Date

