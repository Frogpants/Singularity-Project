import math
import random

class Column:
    def __init__(self, id):
        self.id = id
        self.value = 0
        
    def return_digit(self):
        return self.value
    
    def change_digit(self):
        self.value = 0 if self.value else 1
        
class DecimalToBinaryPuzzle:
    def __init__(self, min, max):
        self.max = max
        self.min = min
        self.build_columns()
        self.generate_random()
        
    # Determines maximum amount of columns possible according to max value
    def calculate_columns(self):
        columns = math.ceil(math.log2(self.max + 1))
        return columns
    
    # Builds the column list which contains all the columns inside the list
    def build_columns(self):
        self.columns = []
        for i in range(self.calculate_columns()):
            column = Column(i)
            self.columns.append(column)
        return self.columns
    
    # Changes the column based on id (left to right)
    def change_column(self, id):
        column = self.columns[id]
        column.change_digit()
        return  column.return_digit()
    
    # Generate random decimal number
    def generate_random(self):
        self.decimal_number = random.randint(self.min, self.max)
        
    # Check if the binary input is equal to the decimal number, returns True if correct and False if incorrect
    def confirm_answer(self):
        digits = [column.return_digit() for column in self.columns]
        converted_number = 0
        digits.reverse()
        for i in range(len(digits)):
            converted_number = converted_number + (digits[i] * 2**i)
        if (converted_number == self.decimal_number):
            # Generates new number
            self.difficulty_increase()
            self.generate_random()
            return True
        else:
            return False
        
    # Increasing difficulty (WIP Feature for the future)
    def difficulty_increase(self):
        pass
    