import { useState, useEffect } from 'react'
import { StyleSheet, Text, View, ScrollView } from 'react-native'
import moment from 'moment'
import Date from './Date'

const Calendar = ({ onSelectDate, selected, colors }) => {
    const [dates, setDates] = useState([])

    // get the dates from today to 10 days from now, format them as strings and store them in state
    const getDates = () => {
        const _dates = []
        for (let i = 5; i > 0; i--) {
            const date = moment().subtract(i, 'days')
            _dates.push(date)
        }
        for (let i = 0; i <= 7; i++) {
            const date = moment().add(i, 'days')
            _dates.push(date)
        }
        setDates(_dates)
    }

    useEffect(() => {
        getDates()
    }, [])

    /**
     * scrollPosition is the number of pixels the user has scrolled
     * we divide it by 60 because each date is 80 pixels wide and we want to get the number of dates
     * we add the number of dates to today to get the current month
     * we format it as a string and set it as the currentMonth
     */

    const styles = StyleSheet.create({
        centered: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            color: colors.text,
            fontSize: 20,
            fontWeight: 'bold',
        },
        dateSection: {
            width: '100%',
            marginLeft: 10,
            paddingRight: 10
        },
        scroll: {
            height: 100,

        },
    })



    return (
        <>
            <View style={styles.dateSection}>
                <View style={styles.scroll}>
                    <ScrollView
                        horizontal
                        contentOffset={{x: 85*5+20, y: 0}}
                        snapToOffsets={[85*5+20]}
                        snapToStart={false}
                        snapToEnd={false}
                        snapToAlignment={'end'}
                        showsHorizontalScrollIndicator={false}>
                        {dates.map((date, index) => (
                            <Date
                                key={index}
                                date={date}
                                onSelectDate={onSelectDate}
                                selected={selected}
                                index={index}
                                size={dates.length}
                                colors={colors}
                            />
                        ))}
                    </ScrollView>
                </View>
            </View>
        </>
    )

}

export default Calendar

